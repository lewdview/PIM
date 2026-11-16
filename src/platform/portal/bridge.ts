/**
 * Portal integration for the klyo, CrazyGames and Gamealia builds. vite.config.ts
 * swaps this file in for ./playgama/bridge (same exports) when PIM_PORTAL names
 * one of them, and swaps ./driver for that portal's driver. Everything here is a
 * no-op unless the app was built with VITE_PLATFORM=playgama (the portal build
 * flag), so the web/Farcaster/Tauri builds are untouched.
 *
 * Only the portal's own SDK is loaded (vite.config.ts adds its script tag ahead
 * of the game script) and ads go through it alone:
 *
 * - initPlatform(): installs the audio gate, starts the SDK and wires the
 *   portal's sound switch. Awaited before first render.
 * - markGameReady(): tells the portal the player can interact.
 * - sendGameplayMessage(): gameplay start/stop, for portals that ask for it.
 * - showInterstitial(), showInterstitialAndWait(): the ad break between rounds.
 * - showRewarded(): the monthly build's bonus-song unlock.
 * - setLeaderboardScore(): the month total, on portals that take a score.
 *
 * Progress stays in localStorage. What the Playgama Bridge provides and these
 * portals are not wired for (purchases, an in-game leaderboard panel, portal
 * achievements, portal sharing, banner slots, analytics) answers "not supported",
 * exactly as it does on a Playgama platform without that feature.
 */
import { installAudioGate, setGate } from '../playgama/audioGate';
import { installPathShim } from '../playgama/paths';
import { driver } from './driver';

const IS_PORTAL = import.meta.env.VITE_PLATFORM === 'playgama';

/** Fired on window when the platform wants gameplay paused (ad, tab hidden). */
export const PLATFORM_PAUSE_EVENT = 'pim:platform-pause';

let started = false;
/** True once the portal's SDK is there and has started. */
function live(): boolean {
  return IS_PORTAL && started;
}

let ready = false;
/** Kept for the funnel; nothing saves through a portal call here, so it never fires. */
const saveFailedListeners = new Set<(err: unknown) => void>();
export function onSaveFailed(fn: (err: unknown) => void): () => void {
  saveFailedListeners.add(fn);
  return () => saveFailedListeners.delete(fn);
}

/**
 * Some portals load the game in an iframe with site storage blocked, so
 * localStorage throws. Progress then lives in memory for the session.
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
    setItem: (k: string, v: string) => { data.set(String(k), String(v)); },
    removeItem: (k: string) => { data.delete(String(k)); },
    clear: () => { data.clear(); },
  };
  try {
    Object.defineProperty(window, 'localStorage', { value: mem, configurable: true });
    console.warn('[portal] localStorage is blocked; progress lasts for this session only.');
  } catch (err) {
    console.warn('[portal] localStorage is blocked and could not be replaced:', err);
  }
}

function requestGameplayPause() {
  window.dispatchEvent(new Event(PLATFORM_PAUSE_EVENT));
}

/** Sets up the portal build. Resolves even if the portal's SDK is missing. */
export async function initPlatform(): Promise<void> {
  if (!IS_PORTAL || typeof window === 'undefined') return;
  installPathShim();
  installAudioGate();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) requestGameplayPause();
  });
  ensureLocalStorage();

  // The SDK's script tag sits ahead of the game script, so it has loaded by now.
  if (!driver.present()) {
    console.warn(`[${driver.name}] SDK not loaded; continuing without it.`);
    return;
  }
  try {
    // A portal that never answers must not keep the game from starting.
    await Promise.race([
      Promise.resolve(driver.init({
        setMuted: (muted) => setGate('platform_audio', muted),
        pause: requestGameplayPause,
      })),
      new Promise((resolve) => setTimeout(resolve, 6000)),
    ]);
    started = true;
  } catch (err) {
    console.warn(`[${driver.name}] SDK failed to start; continuing without it:`, err);
  }
}

/** Tells the portal once, after the first interactive screen is up, that the game can be played. */
export function markGameReady(): void {
  if (!live() || ready) return;
  ready = true;
  try { driver.ready(); } catch { /* the portal must never break the game */ }
}

/** Analytics went with the Bridge; the funnel's events are dropped. */
export function sendAnalytics(_event: string, _data: Record<string, unknown>): void {}

export function setAnalyticsGameVersion(_version: string): void {}

/** Gameplay start/stop, for the portals that ask to be told. */
export function sendGameplayMessage(kind: 'gameplay_started' | 'gameplay_stopped'): void {
  if (!live()) return;
  try { driver.gameplay(kind === 'gameplay_started'); } catch { /* never break the game */ }
}

/**
 * The ad break between rounds. Sound is gated and gameplay asked to pause while
 * it is up. `next` runs exactly once: when the break ends, or at once when there
 * is no SDK to show one.
 */
function adBreak(next: () => void): void {
  if (!live()) { next(); return; }
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    clearTimeout(cap);
    setGate('ad', false);
    next();
  };
  // Never hold the screen forever if the portal loses the answer.
  const cap = setTimeout(end, 90_000);
  setGate('ad', true);
  requestGameplayPause();
  try {
    driver.adBreak().then(end, end);
  } catch {
    end();
  }
}

/** Shows an ad break at a natural break. The portal decides how often one really appears. */
export function showInterstitial(_placement: string): void {
  adBreak(() => {});
}

/**
 * Shows an ad break and resolves once it's gone, so a screen can hold its
 * entrance until the player can see it. Resolves at once when there's no ad.
 */
export function showInterstitialAndWait(_placement: string): Promise<void> {
  return new Promise((resolve) => adBreak(resolve));
}

let rewardedOpen = false;

export function isRewardedSupported(): boolean {
  return live() && driver.canReward();
}

/**
 * Shows a rewarded ad. Resolves true only if the portal reported the reward;
 * closing early or a failed ad resolves false.
 */
export function showRewarded(_placement: string): Promise<boolean> {
  if (!live() || !driver.canReward() || rewardedOpen) return Promise.resolve(false);
  rewardedOpen = true;
  return new Promise<boolean>((resolve) => {
    let over = false;
    const end = (granted: boolean) => {
      if (over) return;
      over = true;
      clearTimeout(cap);
      rewardedOpen = false;
      setGate('ad', false);
      resolve(granted);
    };
    const cap = setTimeout(() => end(false), 90_000);
    setGate('ad', true);
    requestGameplayPause();
    try {
      driver.rewarded().then((ok) => end(ok === true), () => end(false));
    } catch {
      end(false);
    }
  });
}

/** Purchases go through the portal only; none are wired in these builds, so the bundle isn't offered. */
export function isPaymentsSupported(): boolean {
  return false;
}

/** Price label for a product from the platform catalog, or null if it isn't listed. */
export async function getProductPrice(_id: string): Promise<string | null> {
  return null;
}

/** Buys a non-consumable product. Resolves true once the platform confirms the purchase. */
export async function purchase(_id: string): Promise<boolean> {
  return false;
}

/** Ids of products the player already owns. */
export async function getPurchasedIds(): Promise<string[]> {
  return [];
}

export type LeaderboardKind = 'not_available' | 'in_game' | 'native' | 'native_popup';
export interface LeaderboardRow { id: string; name: string; score: number; rank: number; photo: string | null }

/**
 * A portal that takes scores keeps the board on its own page, so the kind is
 * 'native': scores are posted, and no board is drawn in the game.
 */
export function leaderboardKind(): LeaderboardKind {
  return live() && driver.canScore() ? 'native' : 'not_available';
}

/**
 * Posts a score. Resolves true once the portal has taken it; false when it
 * refused or never answered, so the caller sends it again next time.
 */
export function setLeaderboardScore(_id: string, score: number): Promise<boolean> {
  if (!live() || !driver.canScore()) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    let over = false;
    const end = (sent: boolean) => {
      if (over) return;
      over = true;
      clearTimeout(cap);
      resolve(sent);
    };
    const cap = setTimeout(() => end(false), 15_000);
    try {
      driver.score(score).then(end, () => end(false));
    } catch {
      end(false);
    }
  });
}

export async function getLeaderboardEntries(_id: string): Promise<LeaderboardRow[]> {
  return [];
}

export async function showLeaderboardPopup(_id: string): Promise<void> {}

/** Nothing leaves the game on these portals. */
export function externalLinksAllowed(): boolean {
  return false;
}

/** Portal-native ways to help the game (no outside links needed). */
export type SocialAction = 'rate' | 'share' | 'favorite' | 'community';

export function socialActions(): SocialAction[] {
  return [];
}

export async function runSocialAction(_action: SocialAction): Promise<void> {}

/** Ways a portal lets a player post an accomplishment. */
export type ShareKind = 'share' | 'post' | 'invite';

export function shareKinds(): ShareKind[] {
  return [];
}

/** Resolves false: no portal share dialog is wired. */
export async function shareThroughPortal(_kind: ShareKind, _text: string, _image?: string): Promise<boolean> {
  return false;
}

/** Portal achievements came from the Bridge; the in-game list still tracks them. */
export async function unlockPortalAchievement(_id: string): Promise<boolean> {
  return false;
}

/** Copies text with the browser's clipboard. */
export async function copyText(text: string): Promise<boolean> {
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

/** Banner slots were the Bridge's; none are used here, so no space is reserved. */
export function setMenuBanners(_on: boolean): void {}

/** Coarse device class for analytics: pointer type plus the browser family. */
export function deviceClass(): string {
  const type = window.matchMedia?.('(pointer: coarse)').matches ? 'mobile' : 'desktop';
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'edge'
    : /Firefox\//.test(ua) ? 'firefox'
    : /Chrome\//.test(ua) ? 'chrome'
    : /Safari\//.test(ua) ? 'safari'
    : 'other';
  return `${type}/${browser}`;
}
