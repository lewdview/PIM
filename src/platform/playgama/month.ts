/**
 * Monthly Playgama build ("PIM: January" etc.): one campaign chapter with its
 * songs bundled, no vault, packs or sign-in. Its five bonus songs open three
 * ways: the chapter's platinum target, one rewarded ad per song, or buying
 * the month's bundle through the Bridge (only offered when the portal
 * supports payments). Unlocks live in localStorage, which bridge.ts mirrors
 * into bridge.storage.
 */
import { getPurchasedIds, isPaymentsSupported, isRewardedSupported, purchase, showRewarded } from './bridge';

/** 0 outside a monthly build. */
export const PLAYGAMA_MONTH: number = __PIM_MONTH__;
/** Perfect runs (a platinum medal) unlock the song's Bombshell artwork during play. */
export const MONTH_BOMBSHELL: boolean = __PIM_MONTH__ > 0 && __PIM_BOMBSHELL__;

/** The bundle's productId in the Playgama dashboard, e.g. PIM_January_Bonus (set in vite.config.ts). */
export const BONUS_PRODUCT_ID: string = __PIM_BONUS_PRODUCT_ID__;
const BUNDLE_KEY = `pg_bonus_bundle_m${PLAYGAMA_MONTH}`;
const songKey = (songId: string) => `pg_bonus_ad_${songId}`;

/** Fired on window when a bonus song or the bundle is unlocked. */
export const BONUS_UNLOCK_EVENT = 'pim:bonus-unlock';

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function write(key: string) {
  try {
    localStorage.setItem(key, 'true');
  } catch { /* storage full or blocked */ }
  window.dispatchEvent(new Event(BONUS_UNLOCK_EVENT));
}

export function ownsBonusBundle(): boolean {
  return PLAYGAMA_MONTH > 0 && read(BUNDLE_KEY);
}

/** A bonus song opened by an ad or by the bundle (the platinum route is chapterProgress's). */
export function isBonusSongBought(songId: string): boolean {
  return PLAYGAMA_MONTH > 0 && (read(BUNDLE_KEY) || read(songKey(songId)));
}

export const canUnlockWithAd = () => PLAYGAMA_MONTH > 0 && isRewardedSupported();
export const canBuyBundle = () => PLAYGAMA_MONTH > 0 && isPaymentsSupported();

export async function unlockSongWithAd(songId: string): Promise<boolean> {
  const granted = await showRewarded('bonus_song');
  if (granted) write(songKey(songId));
  return granted;
}

export async function buyBonusBundle(): Promise<boolean> {
  const ok = await purchase(BONUS_PRODUCT_ID);
  if (ok) write(BUNDLE_KEY);
  return ok;
}

/** Re-applies a bundle bought earlier (another device, cleared storage). */
export async function restoreBonusBundle(): Promise<void> {
  if (!canBuyBundle() || ownsBonusBundle()) return;
  const ids = await getPurchasedIds();
  if (ids.includes(BONUS_PRODUCT_ID)) write(BUNDLE_KEY);
}
