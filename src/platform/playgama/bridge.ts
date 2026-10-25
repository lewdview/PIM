/// <reference types="@playgama/bridge/global" />
/**
 * Playgama Bridge integration. Everything here is a no-op unless the app was
 * built with VITE_PLATFORM=playgama, so the web/Farcaster/Tauri builds and
 * their Supabase saves are untouched.
 *
 * - initPlatform(): loads the SDK, restores saved progress from bridge.storage
 *   into localStorage, and wires pause/audio events. Awaited before first render.
 * - markGameReady(): tells the platform the player can interact.
 * - showInterstitial(): shows an interstitial at a natural break.
 * - showRewarded(), purchase(): the monthly build's bonus-song unlocks.
 */
import { installAudioGate, setGate } from './audioGate';
import { installPathShim } from './paths';
import { menuBannerSpace } from './bannerLayout';

const IS_PLAYGAMA = import.meta.env.VITE_PLATFORM === 'playgama';

/** bridge.storage key that holds the whole local save as one JSON object. */
const SAVE_KEY = 'pim_save';
/** Fired on window when the platform wants gameplay paused (ad, platform pause, tab hidden). */
export const PLATFORM_PAUSE_EVENT = 'pim:platform-pause';

// Session tokens, wallet SDK state and bulky per-run telemetry stay device-local.
const EXCLUDED_KEY = /^(sb-|supabase\.|wagmi|-walletlink|walletlink|WCM_|wc@|telemetry_|chunk_)|pim_save/i;

let ready = false;
let lastSnapshot = '';
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let writing = false;
let dirty = false;

function bridgeOrNull(): typeof window.bridge | null {
  return IS_PLAYGAMA && typeof window !== 'undefined' && window.bridge?.isInitialized ? window.bridge : null;
}

function snapshot(): string {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || EXCLUDED_KEY.test(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return JSON.stringify(data);
}

async function flush(): Promise<void> {
  flushTimer = null;
  const b = bridgeOrNull();
  if (!b) return;
  if (writing) { dirty = true; return; }
  const next = snapshot();
  if (next === lastSnapshot) return;
  writing = true;
  try {
    await b.storage.set(SAVE_KEY, next);
    lastSnapshot = next;
  } catch (err) {
    console.warn('[Playgama] Save failed:', err);
  } finally {
    writing = false;
    // A change that landed while this save was in flight gets its own save.
    if (dirty) { dirty = false; scheduleFlush(); }
  }
}

function scheduleFlush() {
  if (writing) { dirty = true; return; }
  if (flushTimer) return;
  flushTimer = setTimeout(() => void flush(), 1500);
}

/**
 * Some portals load the game in an iframe with site storage blocked, so
 * localStorage throws. Progress then lives in memory for the session and is
 * saved only through bridge.storage, which still works there.
 */
function ensureLocalStorage() {
  try {
    const t = '__pg_probe';
    window.localStorage.setItem(t, t);
    window.localStorage.removeItem(t);
    return;
  } catch { /* blocked: fall through */ }
  const data = new Map<string, string>();
  const mem = {
    get length() { return data.size; },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => (data.has(String(k)) ? data.get(String(k))! : null),
    setItem: (k: string, v: string) => { data.set(String(k), String(v)); if (!EXCLUDED_KEY.test(String(k))) scheduleFlush(); },
    removeItem: (k: string) => { data.delete(String(k)); if (!EXCLUDED_KEY.test(String(k))) scheduleFlush(); },
    clear: () => { data.clear(); scheduleFlush(); },
  };
  try {
    Object.defineProperty(window, 'localStorage', { value: mem, configurable: true });
    console.warn('[Playgama] localStorage is blocked; saving through bridge.storage only.');
  } catch (err) {
    console.warn('[Playgama] localStorage is blocked and could not be replaced:', err);
  }
}

async function restoreSave(b: typeof window.bridge) {
  try {
    const raw = await b.storage.get(SAVE_KEY, false);
    if (typeof raw !== 'string' || !raw) return;
    const data = JSON.parse(raw) as Record<string, string>;
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && !EXCLUDED_KEY.test(key)) localStorage.setItem(key, value);
    }
    lastSnapshot = raw;
  } catch (err) {
    console.warn('[Playgama] Could not restore save:', err);
  }
}

/** Mirrors every localStorage write into bridge.storage (debounced, one batched key). */
function installSaveMirror() {
  const proto = Storage.prototype;
  const nativeSet = proto.setItem;
  const nativeRemove = proto.removeItem;
  const nativeClear = proto.clear;
  proto.setItem = function (this: Storage, key: string, value: string) {
    nativeSet.call(this, key, value);
    if (this === window.localStorage && !EXCLUDED_KEY.test(key)) scheduleFlush();
  };
  proto.removeItem = function (this: Storage, key: string) {
    nativeRemove.call(this, key);
    if (this === window.localStorage && !EXCLUDED_KEY.test(key)) scheduleFlush();
  };
  proto.clear = function (this: Storage) {
    nativeClear.call(this);
    if (this === window.localStorage) scheduleFlush();
  };
  // Write promptly when the player leaves or the device rotates.
  const flushNow = () => {
    if (flushTimer) clearTimeout(flushTimer);
    void flush();
  };
  window.addEventListener('pagehide', flushNow);
  window.addEventListener('orientationchange', flushNow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushNow();
  });
}

function requestGameplayPause() {
  window.dispatchEvent(new Event(PLATFORM_PAUSE_EVENT));
}

let rewardedResolve: ((granted: boolean) => void) | null = null;
let rewardedGranted = false;

function onRewardedState(state: string) {
  // 'rewarded' arrives while the ad is still on screen, so only closed/failed lift the gate.
  const isOpen = state === 'loading' || state === 'opened' || state === 'rewarded';
  setGate('ad', isOpen);
  if (state === 'opened') requestGameplayPause();
  if (state === 'rewarded') rewardedGranted = true;
  if ((state === 'closed' || state === 'failed') && rewardedResolve) {
    const resolve = rewardedResolve;
    rewardedResolve = null;
    resolve(rewardedGranted);
  }
}

const interstitialListeners = new Set<(state: string) => void>();

function onInterstitialState(state: string) {
  const isOpen = state === 'opened';
  setGate('ad', isOpen);
  if (isOpen) requestGameplayPause();
  interstitialListeners.forEach((fn) => fn(state));
}

/** Initializes the Bridge SDK and restores progress. Resolves even if the SDK is missing. */
export async function initPlatform(): Promise<void> {
  if (!IS_PLAYGAMA || typeof window === 'undefined') return;
  installPathShim();
  installAudioGate();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) requestGameplayPause();
  });

  const b = window.bridge;
  if (!b) {
    console.warn('[Playgama] Bridge SDK not loaded; continuing without it.');
    return;
  }
  try {
    await b.initialize();
  } catch (err) {
    console.warn('[Playgama] Bridge initialize failed:', err);
    return;
  }

  ensureLocalStorage();
  await restoreSave(b);
  installSaveMirror();

  const { EVENT_NAME } = b;
  setGate('platform_audio', !b.platform.isAudioEnabled);
  setGate('platform_pause', b.platform.isPaused);
  b.platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, (isEnabled: boolean) => setGate('platform_audio', !isEnabled));
  b.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
    setGate('platform_pause', isPaused);
    if (isPaused) requestGameplayPause();
  });
  b.advertisement.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onInterstitialState);
  b.advertisement.on(EVENT_NAME.REWARDED_STATE_CHANGED, onRewardedState);
  // A platform pre-roll may already be on screen when initialize() resolves.
  onInterstitialState(b.advertisement.interstitialState);
}

/** Sends `game_ready` once, after the first interactive screen is up. */
export function markGameReady(): void {
  const b = bridgeOrNull();
  if (!b || ready) return;
  ready = true;
  b.platform.sendMessage(b.PLATFORM_MESSAGE.GAME_READY).catch(() => {});
}

export function sendGameplayMessage(kind: 'gameplay_started' | 'gameplay_stopped'): void {
  const b = bridgeOrNull();
  if (!b) return;
  b.platform.sendMessage(kind).catch(() => {});
}

/** Shows an interstitial at a natural break. The SDK enforces the minimum delay between ads. */
export function showInterstitial(placement: string): void {
  const b = bridgeOrNull();
  if (!b || !b.advertisement.isInterstitialSupported) return;
  b.advertisement.showInterstitial(placement);
}

/**
 * Shows an interstitial and resolves once it's gone, so a screen can hold its
 * entrance until the player can see it. Resolves at once when there's no ad,
 * and after `waitMs` when the SDK skips this one (minimum delay not reached).
 */
export function showInterstitialAndWait(placement: string, waitMs = 600): Promise<void> {
  const b = bridgeOrNull();
  if (!b || !b.advertisement.isInterstitialSupported) return Promise.resolve();
  return new Promise((resolve) => {
    let started = false;
    const done = () => {
      interstitialListeners.delete(listen);
      clearTimeout(skip);
      clearTimeout(cap);
      resolve();
    };
    const listen = (state: string) => {
      if (state === 'loading' || state === 'opened') started = true;
      if (state === 'closed' || state === 'failed') done();
    };
    const skip = setTimeout(() => { if (!started) done(); }, waitMs);
    // Never hold the screen forever if the SDK loses a state event.
    const cap = setTimeout(done, 90_000);
    interstitialListeners.add(listen);
    b.advertisement.showInterstitial(placement);
  });
}

export function isRewardedSupported(): boolean {
  return !!bridgeOrNull()?.advertisement.isRewardedSupported;
}

/**
 * Shows a rewarded ad. Resolves true only if the platform reported the reward
 * (state 'rewarded'); closing early or a failed ad resolves false.
 */
export function showRewarded(placement: string): Promise<boolean> {
  const b = bridgeOrNull();
  if (!b || !b.advertisement.isRewardedSupported || rewardedResolve) return Promise.resolve(false);
  rewardedGranted = false;
  return new Promise<boolean>((resolve) => {
    rewardedResolve = resolve;
    try {
      b.advertisement.showRewarded(placement);
    } catch {
      rewardedResolve = null;
      resolve(false);
    }
  });
}

/** True when the portal takes in-game payments (a new Playgama account usually doesn't yet). */
export function isPaymentsSupported(): boolean {
  return !!bridgeOrNull()?.payments.isSupported;
}

/** Price label for a product from the platform catalog, or null if it isn't listed. */
export async function getProductPrice(id: string): Promise<string | null> {
  const b = bridgeOrNull();
  if (!b || !b.payments.isSupported) return null;
  try {
    const product = (await b.payments.getCatalog()).find((p) => p.id === id);
    return product?.price != null ? String(product.price) : null;
  } catch {
    return null;
  }
}

/** Buys a non-consumable product. Resolves true once the platform confirms the purchase. */
export async function purchase(id: string): Promise<boolean> {
  const b = bridgeOrNull();
  if (!b || !b.payments.isSupported) return false;
  try {
    await b.payments.purchase(id);
    return true;
  } catch {
    return false;
  }
}

/** Ids of products the player already owns (restores a bundle bought on another device). */
export async function getPurchasedIds(): Promise<string[]> {
  const b = bridgeOrNull();
  if (!b || !b.payments.isSupported) return [];
  try {
    return (await b.payments.getPurchases()).map((p) => p.id);
  } catch {
    return [];
  }
}

export type LeaderboardKind = 'not_available' | 'in_game' | 'native' | 'native_popup';
export interface LeaderboardRow { id: string; name: string; score: number; rank: number; photo: string | null }

/**
 * How this portal offers leaderboards: 'in_game' (we draw the entries),
 * 'native_popup' (the portal draws them on request), 'native' (the portal shows
 * them on its own page) or 'not_available'.
 */
export function leaderboardKind(): LeaderboardKind {
  return (bridgeOrNull()?.leaderboards.type as LeaderboardKind | undefined) ?? 'not_available';
}

export async function setLeaderboardScore(id: string, score: number): Promise<boolean> {
  const b = bridgeOrNull();
  if (!b || leaderboardKind() === 'not_available') return false;
  try {
    await b.leaderboards.setScore(id, score);
    return true;
  } catch (err) {
    console.warn('[Playgama] Leaderboard score failed:', err);
    return false;
  }
}

export async function getLeaderboardEntries(id: string): Promise<LeaderboardRow[]> {
  const b = bridgeOrNull();
  if (!b || leaderboardKind() !== 'in_game') return [];
  try {
    return (await b.leaderboards.getEntries(id)) as LeaderboardRow[];
  } catch {
    return [];
  }
}

export async function showLeaderboardPopup(id: string): Promise<void> {
  const b = bridgeOrNull();
  if (!b || leaderboardKind() !== 'native_popup') return;
  try {
    await b.leaderboards.showNativePopup(id);
  } catch { /* closed or refused */ }
}

/** True only on portals that allow links out of the game (playgama.com does not). */
export function externalLinksAllowed(): boolean {
  return !!bridgeOrNull()?.platform.isExternalLinksAllowed;
}

/** Portal-native ways to help the game (no outside links needed). */
export type SocialAction = 'rate' | 'share' | 'favorite' | 'community';

export function socialActions(): SocialAction[] {
  const s = bridgeOrNull()?.social;
  if (!s) return [];
  const out: SocialAction[] = [];
  if (s.isRateSupported) out.push('rate');
  if (s.isAddToFavoritesSupported) out.push('favorite');
  if (s.isShareSupported) out.push('share');
  if (s.isJoinCommunitySupported) out.push('community');
  return out;
}

export async function runSocialAction(action: SocialAction): Promise<void> {
  const s = bridgeOrNull()?.social;
  if (!s) return;
  try {
    if (action === 'rate') await s.rate();
    else if (action === 'favorite') await s.addToFavorites();
    else if (action === 'share') await s.share({ text: DEFAULT_SHARE_TEXT });
    else await s.joinCommunity();
  } catch { /* closed or refused */ }
}

const DEFAULT_SHARE_TEXT = 'PIM: a rhythm game made from 365 days of songs by th3scr1b3.';

/** Ways this portal lets a player post an accomplishment (Discord, Reddit, VK, OK, Facebook...). */
export type ShareKind = 'share' | 'post' | 'invite';

export function shareKinds(): ShareKind[] {
  const s = bridgeOrNull()?.social;
  if (!s) return [];
  const out: ShareKind[] = [];
  if (s.isShareSupported) out.push('share');
  if (s.isCreatePostSupported) out.push('post');
  if (s.isInviteFriendsSupported) out.push('invite');
  return out;
}

/**
 * Posts an accomplishment through the portal. `image` is a data URL of the
 * result card; portals that only take a hosted image skip it. Resolves false
 * when the player closed the dialog or the portal refused.
 */
export async function shareThroughPortal(kind: ShareKind, text: string, image?: string): Promise<boolean> {
  const s = bridgeOrNull()?.social;
  if (!s) return false;
  const options = image ? { text, image } : { text };
  try {
    if (kind === 'share') await s.share(options);
    else if (kind === 'post') await s.createPost(options);
    else await s.inviteFriends(options);
    return true;
  } catch {
    return false;
  }
}

/** Unlocks an achievement on the portal (native on Y8/Lagged, tracked by the SDK elsewhere). */
export async function unlockPortalAchievement(id: string): Promise<boolean> {
  const a = bridgeOrNull()?.achievements;
  if (!a) return false;
  try {
    await a.unlock(id);
    return true;
  } catch {
    return false;
  }
}

/** Copies text, through the Bridge where the portal wraps the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  const c = bridgeOrNull()?.clipboard;
  if (c?.isSupported) {
    try {
      await c.write(text);
      return true;
    } catch { /* fall through to the browser */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* blocked inside some portal frames */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Advanced banners (the `menu` placement in playgama-bridge-config.json): a rail
 * on wide screens or a strip on portrait ones, shown on the chapter and results
 * screens only. Bridge lays the slots over the page and hides them during
 * interstitials and rewarded ads; we measure them and publish the space they take
 * as --pg-ad-right / --pg-ad-bottom so those screens shrink to make room.
 */
let bannersWanted = false;
let bannersWired = false;

function reserveBannerSpace() {
  const root = document.documentElement.style;
  let right = 0;
  let bottom = 0;
  const shown = bannersWanted && bridgeOrNull()?.advertisement.advancedBannersState === 'shown';
  if (shown) {
    for (const el of document.querySelectorAll<HTMLElement>('[id^="advanced-banner-"]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right >= innerWidth - 1 && r.height > r.width) right = Math.max(right, innerWidth - r.left);
      else if (r.bottom >= innerHeight - 1) bottom = Math.max(bottom, innerHeight - r.top);
    }
    // Portals draw the slots outside our page, so fall back to the configured layout.
    if (!right && !bottom) ({ right, bottom } = menuBannerSpace(innerWidth, innerHeight));
  }
  root.setProperty('--pg-ad-right', `${Math.round(right)}px`);
  root.setProperty('--pg-ad-bottom', `${Math.round(bottom)}px`);
  document.documentElement.dataset.pgAd = right ? 'right' : bottom ? 'bottom' : '';
}

export function setMenuBanners(on: boolean): void {
  const b = bridgeOrNull();
  if (!b || !b.advertisement.isAdvancedBannersSupported || on === bannersWanted) return;
  bannersWanted = on;
  if (!bannersWired) {
    bannersWired = true;
    // Bridge re-lays the slots ~200 ms after a resize or rotation.
    b.advertisement.on(b.EVENT_NAME.ADVANCED_BANNERS_STATE_CHANGED, () => requestAnimationFrame(reserveBannerSpace));
    addEventListener('resize', () => setTimeout(reserveBannerSpace, 350));
  }
  if (on) b.advertisement.showAdvancedBanners('menu');
  else b.advertisement.hideAdvancedBanners();
  reserveBannerSpace();
}
