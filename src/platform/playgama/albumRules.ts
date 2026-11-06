/**
 * Chapter Album rules (spec sections 6 to 9), kept free of browser storage so
 * scripts/check-album.mjs can test them: packs, the first-pack and Rare
 * guarantees, replay stamps, duplicate shards and crafting.
 *
 * Every function takes the state and returns a new one; album.ts saves it.
 * A pack's cards are rolled and resolved (new or duplicate, shards) when the
 * pack is awarded, so a reload, a skipped reveal or a replayed reveal shows
 * the same cards and never awards them twice.
 */

/** 0 Common, 1 Uncommon, 2 Rare. */
export type Rarity = 0 | 1 | 2;
export const RARITY_NAME = ['Common', 'Uncommon', 'Rare'] as const;
/** Shown next to the rarity name so rarity never rests on color alone. */
export const RARITY_GLYPH = ['●', '◆', '★'] as const;

/** Base odds for one random slot (Common, Uncommon, Rare). */
export const BASE_WEIGHTS: readonly [number, number, number] = [65, 30, 5];
/** No more than this many awarded packs in a row without a Rare. */
export const RARE_PITY = 10;
export const STAMPS_PER_PACK = 3;
/** Album Shards from a duplicate, by rarity. */
export const DUPE_SHARDS: readonly [number, number, number] = [1, 3, 9];
/** Shards to craft a missing variant, by rarity. */
export const CRAFT_COST: readonly [number, number, number] = [6, 12, 30];
/** Share of scorable notes the player must try for (section 7, valid finish). */
export const MIN_PARTICIPATION = 0.3;

export type PackSource = 'first_finish' | 'platinum' | 'stamps';
export const PACK_SOURCE_LABEL: Record<PackSource, string> = {
  first_finish: 'First finish',
  platinum: 'First Standard platinum',
  stamps: 'Replay stamps',
};

export interface PackCard {
  songId: string;
  r: Rarity;
  /** True when the variant was already owned, so this copy became shards. */
  dup: boolean;
  shards: number;
  /** How the slot was decided: the finished entry's card, a guarantee, or the base roll. */
  why: 'entry' | 'first_pack' | 'pity' | 'roll';
}

export interface Pack {
  id: string;
  source: PackSource;
  /** The entry whose finish or platinum earned it (none for stamp packs). */
  songId?: string;
  runId: string;
  at: number;
  cards: PackCard[];
  opened: boolean;
  /** Packs since the last Rare before this one (shown in pack details). */
  pityBefore: number;
}

export interface AlbumState {
  v: 1;
  chapter: string;
  /** Copies received per entry and rarity (crafted ones included). Owned means at least one. */
  got: Record<string, [number, number, number]>;
  /** Variants not yet seen in the album, as "songId:r". */
  fresh: string[];
  shards: number;
  stamps: number;
  /** Awarded packs since the last one holding a Rare. */
  sinceRare: number;
  packsAwarded: number;
  packs: Pack[];
  /** Reward receipts: "ff:<song>", "pl:<song>", "st:<run>", each awarded once. */
  receipts: Record<string, number>;
  /** Existing players see the "packs start now" note once (section 11). */
  migrated: boolean;
  noticeSeen: boolean;
  createdAt: number;
}

/** Entries cards can come from: every regular entry, plus bonus entries once unlocked. */
export interface AlbumPool {
  regular: string[];
  bonus: string[];
  bonusOpen: string[];
}

export const eligible = (pool: AlbumPool) => [...pool.regular, ...pool.bonusOpen];

export function emptyAlbum(chapter: string, migrated: boolean, now = Date.now()): AlbumState {
  return {
    v: 1, chapter, got: {}, fresh: [], shards: 0, stamps: 0, sinceRare: 0, packsAwarded: 0,
    packs: [], receipts: {}, migrated, noticeSeen: !migrated, createdAt: now,
  };
}

export const owns = (s: AlbumState, songId: string, r: Rarity) => (s.got[songId]?.[r] ?? 0) > 0;
export const ownsAny = (s: AlbumState, songId: string) => [0, 1, 2].some((r) => owns(s, songId, r as Rarity));

function clone(s: AlbumState): AlbumState {
  return {
    ...s,
    got: Object.fromEntries(Object.entries(s.got).map(([k, v]) => [k, [...v] as [number, number, number]])),
    fresh: [...s.fresh],
    packs: s.packs.map((p) => ({ ...p, cards: p.cards.map((c) => ({ ...c })) })),
    receipts: { ...s.receipts },
  };
}

export type Rng = () => number;

export function rollRarity(rng: Rng): Rarity {
  const total = BASE_WEIGHTS[0] + BASE_WEIGHTS[1] + BASE_WEIGHTS[2];
  const x = rng() * total;
  if (x < BASE_WEIGHTS[0]) return 0;
  if (x < BASE_WEIGHTS[0] + BASE_WEIGHTS[1]) return 1;
  return 2;
}

const pick = <T,>(list: T[], rng: Rng): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** Gives one copy to the state, turning a duplicate into shards (resolved in order, so a repeat in the same pack converts). */
function grantCard(s: AlbumState, songId: string, r: Rarity, why: PackCard['why']): PackCard {
  const counts = s.got[songId] ?? [0, 0, 0];
  const dup = counts[r] > 0;
  counts[r] += 1;
  s.got[songId] = counts;
  const shards = dup ? DUPE_SHARDS[r] : 0;
  s.shards += shards;
  if (!dup && !s.fresh.includes(`${songId}:${r}`)) s.fresh.push(`${songId}:${r}`);
  return { songId, r, dup, shards, why };
}

/**
 * Rolls and awards one three-card pack. A first-finish pack's first slot is
 * the finished entry's Common; the rest roll from the pool. The first pack
 * ever has an Uncommon in slot two; the tenth pack since the last Rare turns
 * its final random slot Rare if it has none.
 */
export function awardPack(state: AlbumState, opts: { source: PackSource; songId?: string; runId: string; pool: AlbumPool; rng: Rng; now?: number }): { state: AlbumState; pack: Pack } {
  const s = clone(state);
  const pool = eligible(opts.pool);
  if (!pool.length) throw new Error('album: empty pool');
  const firstEver = s.packsAwarded === 0;
  type Slot = { songId: string; r: Rarity; why: PackCard['why'] };
  const slots: Slot[] = [];
  const entrySlot = opts.source === 'first_finish' && !!opts.songId;
  if (entrySlot) slots.push({ songId: opts.songId!, r: 0, why: 'entry' });
  while (slots.length < 3) {
    const forcedUncommon = firstEver && slots.length === 1;
    slots.push({ songId: pick(pool, opts.rng), r: forcedUncommon ? 1 : rollRarity(opts.rng), why: forcedUncommon ? 'first_pack' : 'roll' });
  }
  const pityBefore = s.sinceRare;
  if (s.sinceRare >= RARE_PITY - 1 && !slots.some((c) => c.r === 2)) {
    // The final random slot: the last one, as slot one of a first-finish pack is fixed.
    const last = slots[slots.length - 1];
    slots[slots.length - 1] = { songId: last.songId, r: 2, why: 'pity' };
  }
  const cards = slots.map((c) => grantCard(s, c.songId, c.r, c.why));
  s.sinceRare = cards.some((c) => c.r === 2) ? 0 : s.sinceRare + 1;
  s.packsAwarded += 1;
  const pack: Pack = {
    id: `${s.chapter}-p${s.packsAwarded}`,
    source: opts.source,
    songId: opts.songId,
    runId: opts.runId,
    at: opts.now ?? Date.now(),
    cards,
    opened: false,
    pityBefore,
  };
  s.packs.push(pack);
  return { state: s, pack };
}

export interface FinishInput {
  runId: string;
  /** Album entry (a Deluxe run counts for its base entry). */
  songId: string;
  failed: boolean;
  /** 0..1 */
  participation: number;
  mode: 'intro' | 'relaxed' | 'standard';
  assisted: boolean;
  medal: string;
  deluxe: boolean;
}

export interface FinishReward {
  state: AlbumState;
  packs: Pack[];
  /** Stamps added by this run (0 or 1) and the total after any conversion. */
  stamp: boolean;
  stamps: number;
  /** The run reached the end but tried too few notes: rewards withheld, with a reason to show. */
  withheld: boolean;
  /** Receipts this run created, for telemetry. */
  granted: { receipt: string; type: 'pack' | 'stamp'; source: PackSource | 'stamp'; first: boolean }[];
}

/**
 * Rewards for one finished run (section 7). Once-only rewards are keyed by
 * entry and the stamp by run, so a duplicate callback or a reload awards
 * nothing new.
 */
export function rewardFinish(state: AlbumState, run: FinishInput, pool: AlbumPool, rng: Rng, now = Date.now()): FinishReward {
  let s = state;
  const packs: Pack[] = [];
  const granted: FinishReward['granted'] = [];
  const none = { state, packs, stamp: false, stamps: state.stamps, withheld: false, granted };
  if (run.failed) return none;
  if (run.participation < MIN_PARTICIPATION) return { ...none, withheld: true };
  const runKey = `st:${run.runId}`;
  // This run was already rewarded (finish screen reloaded, callback repeated).
  if (s.receipts[runKey] !== undefined || s.receipts[`run:${run.runId}`] !== undefined) return none;

  s = clone(s);
  s.receipts[`run:${run.runId}`] = now;
  const ffKey = `ff:${run.songId}`;
  const firstFinish = s.receipts[ffKey] === undefined;
  if (firstFinish) {
    const r = awardPack(s, { source: 'first_finish', songId: run.songId, runId: run.runId, pool, rng, now });
    s = r.state;
    s.receipts[ffKey] = now;
    packs.push(r.pack);
    granted.push({ receipt: ffKey, type: 'pack', source: 'first_finish', first: true });
  }
  const plKey = `pl:${run.songId}`;
  if (!run.deluxe && run.mode === 'standard' && !run.assisted && run.medal === 'PLATINUM' && s.receipts[plKey] === undefined) {
    const r = awardPack(s, { source: 'platinum', songId: run.songId, runId: run.runId, pool, rng, now });
    s = r.state;
    s.receipts[plKey] = now;
    packs.push(r.pack);
    granted.push({ receipt: plKey, type: 'pack', source: 'platinum', first: firstFinish });
  }
  let stamp = false;
  if (!firstFinish) {
    stamp = true;
    s.stamps += 1;
    s.receipts[runKey] = now;
    granted.push({ receipt: runKey, type: 'stamp', source: 'stamp', first: false });
    while (s.stamps >= STAMPS_PER_PACK) {
      s.stamps -= STAMPS_PER_PACK;
      const r = awardPack(s, { source: 'stamps', runId: run.runId, pool, rng, now });
      s = r.state;
      packs.push(r.pack);
      granted.push({ receipt: `${runKey}:pack`, type: 'pack', source: 'stamps', first: false });
    }
  }
  return { state: s, packs, stamp, stamps: s.stamps, withheld: false, granted };
}

export type CraftCheck = 'ok' | 'owned' | 'shards' | 'locked';

export function canCraft(s: AlbumState, songId: string, r: Rarity, pool: AlbumPool): CraftCheck {
  if (!eligible(pool).includes(songId)) return 'locked';
  if (owns(s, songId, r)) return 'owned';
  if (s.shards < CRAFT_COST[r]) return 'shards';
  return 'ok';
}

/** Spends shards on one missing variant. Crafted cards give no packs, shards or stamps and leave the Rare counter alone. */
export function craft(state: AlbumState, songId: string, r: Rarity, pool: AlbumPool): AlbumState | null {
  if (canCraft(state, songId, r, pool) !== 'ok') return null;
  const s = clone(state);
  s.shards -= CRAFT_COST[r];
  const counts = s.got[songId] ?? [0, 0, 0];
  counts[r] = 1;
  s.got[songId] = counts;
  if (!s.fresh.includes(`${songId}:${r}`)) s.fresh.push(`${songId}:${r}`);
  return s;
}

export function markOpened(state: AlbumState, packId: string): AlbumState {
  const s = clone(state);
  const p = s.packs.find((x) => x.id === packId);
  if (p) p.opened = true;
  // Opened packs older than the last 40 are only history; drop them to keep the save small.
  const opened = s.packs.filter((x) => x.opened);
  if (opened.length > 40) {
    const drop = new Set(opened.slice(0, opened.length - 40).map((x) => x.id));
    s.packs = s.packs.filter((x) => !drop.has(x.id));
  }
  return s;
}

export function clearFresh(state: AlbumState, keys?: string[]): AlbumState {
  const s = clone(state);
  s.fresh = keys ? s.fresh.filter((k) => !keys.includes(k)) : [];
  return s;
}

/** Variants whose only copies are still in unopened packs: the album keeps them hidden until the reveal. */
export function hiddenVariants(s: AlbumState): Set<string> {
  const pending = new Map<string, number>();
  for (const p of s.packs) if (!p.opened) for (const c of p.cards) {
    const k = `${c.songId}:${c.r}`;
    pending.set(k, (pending.get(k) ?? 0) + 1);
  }
  const out = new Set<string>();
  for (const [k, n] of pending) {
    const [id, r] = k.split(':');
    if ((s.got[id]?.[Number(r)] ?? 0) <= n) out.add(k);
  }
  return out;
}

export interface Completion {
  regularOwned: number;
  regularVariants: number;
  bonusOwned: number;
  bonusVariants: number;
  collector: boolean;
  complete: boolean;
}

export function completion(s: AlbumState, pool: AlbumPool, hidden = hiddenVariants(s)): Completion {
  const has = (id: string, r: number) => (s.got[id]?.[r] ?? 0) > 0 && !hidden.has(`${id}:${r}`);
  const count = (ids: string[]) => ({
    any: ids.filter((id) => [0, 1, 2].some((r) => has(id, r))).length,
    variants: ids.reduce((n, id) => n + [0, 1, 2].filter((r) => has(id, r)).length, 0),
  });
  const reg = count(pool.regular);
  const bon = count(pool.bonus);
  return {
    regularOwned: reg.any,
    regularVariants: reg.variants,
    bonusOwned: bon.any,
    bonusVariants: bon.variants,
    collector: pool.regular.length > 0 && reg.any === pool.regular.length,
    complete: pool.regular.length > 0 && reg.variants === pool.regular.length * 3,
  };
}

/** Reads a saved state, or null if it isn't one (wrong chapter, unknown version, damaged). */
export function parseAlbum(raw: string | null, chapter: string): AlbumState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as AlbumState;
    if (!s || s.v !== 1 || s.chapter !== chapter || typeof s.got !== 'object' || !Array.isArray(s.packs)) return null;
    return {
      ...emptyAlbum(chapter, false, s.createdAt),
      ...s,
      shards: Math.max(0, Number(s.shards) || 0),
      stamps: Math.max(0, Number(s.stamps) || 0),
      fresh: Array.isArray(s.fresh) ? s.fresh : [],
      receipts: s.receipts && typeof s.receipts === 'object' ? s.receipts : {},
    };
  } catch {
    return null;
  }
}
