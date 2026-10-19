/**
 * Platform switch. The Playgama build (`npm run build:playgama`) sets
 * VITE_PLATFORM=playgama; every other build leaves the platform layer inert so
 * the web, Farcaster and Tauri apps behave exactly as before.
 */
export const IS_PLAYGAMA = import.meta.env.VITE_PLATFORM === 'playgama';

export {
  initPlatform,
  PLATFORM_PAUSE_EVENT,
  markGameReady,
  sendGameplayMessage,
  setMenuBanners,
  showInterstitial,
  showInterstitialAndWait,
} from './playgama/bridge';
export { appUrl, APP_BASE } from './playgama/paths';
export { sfxUrl } from './playgama/sfx';
