/**
 * Chapter Album for a monthly build (spec sections 6 to 12), on in every monthly
 * build unless it passes --no-album (__PIM_ALBUM__). Rules live in albumRules.ts; this
 * file loads and saves the state and supplies the chapter's entries.
 *
 * The state is one localStorage key per chapter (pg_album_m1 ...), so months
 * never overwrite each other, and bridge.ts mirrors it into the portal save
 * with the rest of the progress. The previous good copy sits next to it.
 */
import { cachedCatalog, type GameSong } from '@/game/api';
import { CHAPTERS } from '@/game/campaign';
import { chapterProgress, isStageUnlocked, songsForMonth } from '@/game/chapterStory';
import { isBonusSongBought, PLAYGAMA_MONTH } from './month';
import { hasFirstFinish } from './runMode';
import { track } from './funnel';
import {
  awardPack, clearFresh, completion, craft as craftRule, emptyAlbum, markOpened, parseAlbum, rewardFinish,
  type AlbumPool, type AlbumState, type FinishInput, type FinishReward, type Rarity, RARITY_NAME,
} from './albumRules';

export * from './albumRules';

/** True in a monthly build (unless made with --no-album). */
export const ALBUM_ON: boolean = __PIM_MONTH__ > 0 && __PIM_ALBUM__;

const CHAPTER = `m${PLAYGAMA_MONTH}`;
const KEY = `pg_album_${CHAPTER}`;
const PREV_KEY = `pg_album_${CHAPTER}_prev`;
/** Fired on window after every save, so open screens re-read the album. */
export const ALBUM_EVENT = 'pim:album';

let cache: AlbumState | null = null;
let lastSaveFailed = false;

export function loadAlbum(): AlbumState {
  if (cache) return cache;
  let raw: string | null = null;
  let prev: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    prev = localStorage.getItem(PREV_KEY);
  } catch { /* storage blocked: start empty, saves will report the failure */ }
  cache = parseAlbum(raw, CHAPTER) ?? parseAlbum(prev, CHAPTER);
  if (!cache) {
    // Section 11: no packs for earlier progress; existing players are told once how packs start.
    cache = emptyAlbum(CHAPTER, hasFirstFinish());
    saveAlbum(cache);
  }
  return cache;
}

/** Writes the whole state in one go (pack contents and receipts together). Returns false if storage refused it. */
export function saveAlbum(s: AlbumState): boolean {
  cache = s;
  try {
    const cur = localStorage.getItem(KEY);
    if (cur) localStorage.setItem(PREV_KEY, cur);
    localStorage.setItem(KEY, JSON.stringify(s));
    lastSaveFailed = false;
  } catch (err) {
    lastSaveFailed = true;
    track('save_failed', { op: 'album', error: err instanceof Error ? err.name : 'unknown' }, 'save_failed_album');
  }
  window.dispatchEvent(new Event(ALBUM_EVENT));
  return !lastSaveFailed;
}

export const albumSaveFailed = () => lastSaveFailed;
/** Retry button on the "Progress could not be saved" notice. */
export const retryAlbumSave = () => saveAlbum(loadAlbum());

function rng(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 2 ** 32;
  } catch {
    return Math.random();
  }
}

/** The chapter's entries split for the album, from the loaded catalog (or the songs given). */
export function chapterPool(songs?: GameSong[]): AlbumPool | null {
  const list = songs ?? (cachedCatalog() ? songsForMonth(cachedCatalog()!, PLAYGAMA_MONTH) : null);
  if (!list?.length) return null;
  const meta = CHAPTERS.find((c) => c.month === PLAYGAMA_MONTH) ?? CHAPTERS[0];
  const p = chapterProgress(list, meta);
  const n = p.regular.length;
  return {
    regular: p.regular.map((s) => s.id),
    bonus: p.bonus.map((s) => s.id),
    bonusOpen: p.bonus.filter((s, i) => isStageUnlocked(n + i, p) || isBonusSongBought(s.id)).map((s) => s.id),
  };
}

export const unopenedPacks = (s = loadAlbum()) => s.packs.filter((p) => !p.opened);

/**
 * Called by gameplay when a run ends (section 7). Saves before anything is
 * shown. Returns null outside an album build or without the chapter list.
 */
export function rewardRun(run: FinishInput): (FinishReward & { saved: boolean }) | null {
  if (!ALBUM_ON) return null;
  const pool = chapterPool();
  if (!pool || ![...pool.regular, ...pool.bonus].includes(run.songId)) return null;
  const before = loadAlbum();
  const r = rewardFinish(before, run, pool, rng);
  const saved = r.state === before ? true : saveAlbum(r.state);
  for (const g of r.granted) {
    const pack = g.type === 'pack' ? r.packs.find((p) => p.source === g.source) : undefined;
    track('reward_granted', {
      run: run.runId, song: run.songId, receipt: g.receipt, reward: g.type, source: g.source, first: g.first,
      mode: run.mode, stamps: r.stamps,
      ...(pack ? { pack: pack.id, rare: pack.cards.some((c) => c.r === 2), pity_before: pack.pityBefore } : {}),
    });
  }
  return { ...r, saved };
}

export function openPack(packId: string): void {
  saveAlbum(markOpened(loadAlbum(), packId));
}

export function seeFresh(keys?: string[]): void {
  const s = loadAlbum();
  if (!s.fresh.length) return;
  saveAlbum(clearFresh(s, keys));
}

export function dismissNotice(): void {
  const s = loadAlbum();
  if (!s.noticeSeen) saveAlbum({ ...s, noticeSeen: true });
}

export function craftCard(songId: string, r: Rarity, pool: AlbumPool): boolean {
  const before = loadAlbum();
  const next = craftRule(before, songId, r, pool);
  if (!next) return false;
  const ok = saveAlbum(next);
  const c = completion(next, pool);
  track('card_crafted', { song: songId, rarity: RARITY_NAME[r], shards_left: next.shards, regular_owned: c.regularOwned, variants: c.regularVariants });
  return ok;
}

export function trackAlbumOpened(pool: AlbumPool, from: string): void {
  const s = loadAlbum();
  const c = completion(s, pool);
  track('album_opened', {
    from, regular_owned: c.regularOwned, variants: c.regularVariants, bonus_owned: c.bonusOwned,
    shards: s.shards, stamps: s.stamps, unopened: unopenedPacks(s).length,
  });
}

export function trackRevealFinished(packId: string, how: 'skipped' | 'animated', ms: number, saved: boolean): void {
  track('pack_reveal_finished', { pack: packId, how, duration_ms: Math.round(ms), saved_pack: saved });
}

/** Test hook for scripts and dev: award a pack without a run. Not reachable from the UI. */
export function devAwardPack(): void {
  const pool = chapterPool();
  if (!pool) return;
  saveAlbum(awardPack(loadAlbum(), { source: 'stamps', runId: `dev-${Date.now()}`, pool, rng }).state);
}
