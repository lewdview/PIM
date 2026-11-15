/**
 * Portal integration for the klyo build (games.klyo.pl). Everything here is a
 * no-op unless the app was built with VITE_PLATFORM=playgama (the portal build
 * flag, name kept so the rest of the app is untouched), so the web/Farcaster/
 * Tauri builds and their Supabase saves are untouched.
 *
 * The Playgama Bridge is gone from this build: no script of that network is
 * loaded and nothing is called on it. Ads go through the klyo SDK only, which
 * vite.config.ts adds to index.html ahead of the game script:
 *
 * - initPlatform(): installs the audio gate and wires the portal's sound switch.
 *   Awaited before first render.
 * - markGameReady(): tells the portal the player can interact (klyo.ready).
 * - showInterstitial(), showInterstitialAndWait(): the ad break between rounds
 *   (klyo.adBreak).
 * - showRewarded(): the monthly build's bonus-song unlock (klyo.rewardedAd).
 * - setLeaderboardScore(): the month total, posted after a round raises it
 *   (klyo.score); klyo shows the board on the game's page.
 *
 * Progress stays in localStorage, which the klyo SDK carries between devices
 * itself. What the Bridge used to provide and klyo is not wired for here
 * (purchases, an in-game leaderboard panel, portal achievements, portal sharing,
 * banner slots, Bridge analytics) answers "not supported", exactly as it already did
 * on a portal without that feature.
 */
import { installAudioGate, setGate } from './audioGate';
import { installPathShim } from './paths';

const IS_PLAYGAMA = import.meta.env.VITE_PLATFORM === 'playgama';

/** Fired on window when the platform wants gameplay paused (ad, tab hidden). */
export const PLATFORM_PAUSE_EVENT = 'pim:platform-pause';

/** The part of the klyo SDK this game uses (https://games.klyo.pl/game-sdk/index.md). */
interface KlyoAnswer { ok?: boolean }
interface KlyoSdk {
  ready?: () => void;
  adBreak?: (placement: string, done: (answer?: KlyoAnswer) => void) => void;
  rewardedAd?: (done: (answer?: KlyoAnswer) => void) => void;
  onSound?: (listener: (soundOn: boolean) => void) => void;
  score?: (points: number, done?: (answer?: KlyoAnswer) => void) => void;
}
declare global {
  interface Window { klyo?: KlyoSdk }
}

/** The klyo SDK once its script has loaded; null in every other build and when it is missing. */
function klyoOrNull(): KlyoSdk | null {
  return IS_PLAYGAMA && typeof window !== 'undefined' && window.klyo ? window.klyo : null;
}

/** klyo's name for the break between rounds. */
const KLYO_BREAK = 'next';

let ready = false;
/** Kept for the funnel; nothing saves through a portal call any more, so it never fires. */
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
    console.warn('[klyo] localStorage is blocked; progress lasts for this session only.');
  } catch (err) {
    console.warn('[klyo] localStorage is blocked and could not be replaced:', err);
  }
}

function requestGameplayPause() {
  window.dispatchEvent(new Event(PLATFORM_PAUSE_EVENT));
}

/** Sets up the portal build. Resolves even if the klyo SDK is missing. */
export async function initPlatform(): Promise<void> {
  if (!IS_PLAYGAMA || typeof window === 'undefined') return;
  installPathShim();
  installAudioGate();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) requestGameplayPause();
  });
  ensureLocalStorage();

  // The SDK's script tag sits ahead of the game script, so it has loaded by now.
  // Its sound switch is wired only if it is really there.
  const k = klyoOrNull();
  if (!k) {
    console.warn('[klyo] SDK not loaded; continuing without it.');
    return;
  }
  try {
    k.onSound?.((soundOn: boolean) => setGate('platform_audio', !soundOn));
  } catch (err) {
    console.warn('[klyo] Could not listen for the sound switch:', err);
  }
}

/** Tells the portal once, after the first interactive screen is up, that the game can be played. */
export function markGameReady(): void {
  const k = klyoOrNull();
  if (!k || ready) return;
  ready = true;
  try { k.ready?.(); } catch { /* the portal must never break the game */ }
}

/** Bridge analytics are gone with the Bridge; the funnel's events are dropped. */
export function sendAnalytics(_event: string, _data: Record<string, unknown>): void {}

export function setAnalyticsGameVersion(_version: string): void {}

/** klyo has no gameplay start/stop message. */
export function sendGameplayMessage(_kind: 'gameplay_started' | 'gameplay_stopped'): void {}

/**
 * The ad break between rounds: klyo.adBreak("next", () => next()). Sound is
 * gated and gameplay asked to pause while it is up. `next` runs exactly once:
 * when the break ends, or at once when there is no SDK to show one.
 */
function adBreak(next: () => void): void {
  const k = klyoOrNull();
  if (!k?.adBreak) { next(); return; }
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
    k.adBreak(KLYO_BREAK, () => end());
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
  return typeof klyoOrNull()?.rewardedAd === 'function';
}

/**
 * Shows a rewarded ad. Resolves true only if the portal reported the reward
 * (answer.ok === true); closing early or a failed ad resolves false.
 */
export function showRewarded(_placement: string): Promise<boolean> {
  const k = klyoOrNull();
  if (!k?.rewardedAd || rewardedOpen) return Promise.resolve(false);
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
      k.rewardedAd!((answer) => end(answer?.ok === true));
    } catch {
      end(false);
    }
  });
}

/** Payments on klyo go through klyo only; none are wired, so the bundle isn't offered. */
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
 * klyo keeps one leaderboard per game and shows it on the game's page, so the
 * kind is 'native': scores are posted, and no board is drawn in the game.
 */
export function leaderboardKind(): LeaderboardKind {
  return typeof klyoOrNull()?.score === 'function' ? 'native' : 'not_available';
}

/**
 * Posts a score with klyo.score. Resolves true once klyo has taken it; false
 * when it refused or never answered, so the caller sends it again next time.
 */
export function setLeaderboardScore(_id: string, score: number): Promise<boolean> {
  const k = klyoOrNull();
  if (!k?.score) return Promise.resolve(false);
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
      k.score!(score, (answer) => end(answer?.ok !== false));
    } catch {
      end(false);
    }
  });
}

export async function getLeaderboardEntries(_id: string): Promise<LeaderboardRow[]> {
  return [];
}

export async function showLeaderboardPopup(_id: string): Promise<void> {}

/** Nothing leaves the game on klyo. */
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

/** Resolves false: there is no portal share dialog on klyo. */
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

/** Banner slots were the Bridge's; there are none on klyo, so no space is reserved. */
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
