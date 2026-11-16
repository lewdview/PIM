// Gamealia (https://gamealia.app/docs/sdk-reference).
import type { PortalDriver } from '../portal/types';

interface GamealiaSdk {
  init?: () => Promise<{ locale?: string } | undefined>;
  on?: (event: string, listener: (payload?: unknown) => void) => unknown;
  game?: {
    loadingStart?: () => void;
    loadingStop?: () => void;
    gameplayStart?: () => void;
    gameplayStop?: () => void;
  };
  ad?: {
    requestMidgame?: () => Promise<{ shown?: boolean; rewarded?: boolean } | undefined>;
    requestRewarded?: () => Promise<{ rewarded?: boolean } | undefined>;
  };
}
declare global {
  interface Window { Gamealia?: GamealiaSdk }
}

const sdk = (): GamealiaSdk | undefined => (typeof window !== 'undefined' ? window.Gamealia : undefined);

/** The game ships in English only; the portal's language is recorded on <html> for when it isn't. */
function noteLocale(locale: unknown) {
  if (typeof locale === 'string' && locale) document.documentElement.setAttribute('data-portal-locale', locale);
}

export const driver: PortalDriver = {
  name: 'gamealia',
  present: () => !!sdk(),
  async init(hooks) {
    const s = sdk();
    const info = await s?.init?.();
    noteLocale(info?.locale);
    s?.game?.loadingStart?.();
    s?.on?.('mute', () => hooks.setMuted(true));
    s?.on?.('unmute', () => hooks.setMuted(false));
    s?.on?.('pause', () => hooks.pause());
    s?.on?.('localeChange', noteLocale);
  },
  // Must be called within 15 s of page load.
  ready() { sdk()?.game?.loadingStop?.(); },
  gameplay(started) {
    const g = sdk()?.game;
    if (started) g?.gameplayStart?.(); else g?.gameplayStop?.();
  },
  async adBreak() {
    // Never rejects; the portal may skip the ad.
    await sdk()?.ad?.requestMidgame?.();
  },
  canReward: () => typeof sdk()?.ad?.requestRewarded === 'function',
  async rewarded() {
    const answer = await sdk()?.ad?.requestRewarded?.();
    return answer?.rewarded === true;
  },
  // The SDK documents no score or leaderboard call.
  canScore: () => false,
  score: () => Promise.resolve(false),
};
