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
 */
import { installAudioGate, setGate } from './audioGate';
import { installPathShim } from './paths';

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
  if (!b || writing) return;
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
  }
}

function scheduleFlush() {
  if (writing || flushTimer) return;
  flushTimer = setTimeout(() => void flush(), 1500);
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

function onInterstitialState(state: string) {
  const isOpen = state === 'opened';
  setGate('ad', isOpen);
  if (isOpen) requestGameplayPause();
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
