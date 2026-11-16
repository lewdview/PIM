// CrazyGames, HTML5 SDK v3 (https://docs.crazygames.com/sdk/intro/).
import type { PortalDriver } from '../portal/types';

interface CrazyAdCallbacks { adStarted?: () => void; adFinished?: () => void; adError?: (error?: unknown) => void }
interface CrazySettings { muteAudio?: boolean }
interface CrazySdk {
  init?: () => Promise<void>;
  game?: {
    settings?: CrazySettings;
    addSettingsChangeListener?: (listener: (settings: CrazySettings) => void) => void;
    loadingStart?: () => void;
    loadingStop?: () => void;
    gameplayStart?: () => void;
    gameplayStop?: () => void;
  };
  ad?: { requestAd?: (type: 'midgame' | 'rewarded', callbacks: CrazyAdCallbacks) => void };
}
declare global {
  interface Window { CrazyGames?: { SDK?: CrazySdk } }
}

const sdk = (): CrazySdk | undefined => (typeof window !== 'undefined' ? window.CrazyGames?.SDK : undefined);

export const driver: PortalDriver = {
  name: 'crazygames',
  present: () => !!sdk(),
  async init(hooks) {
    const s = sdk();
    await s?.init?.();
    s?.game?.loadingStart?.();
    // CrazyGames' own mute button: the game must follow it.
    hooks.setMuted(s?.game?.settings?.muteAudio === true);
    s?.game?.addSettingsChangeListener?.((settings) => hooks.setMuted(settings?.muteAudio === true));
  },
  ready() { sdk()?.game?.loadingStop?.(); },
  gameplay(started) {
    const g = sdk()?.game;
    if (started) g?.gameplayStart?.(); else g?.gameplayStop?.();
  },
  adBreak() {
    return new Promise<void>((resolve) => {
      const ad = sdk()?.ad;
      if (!ad?.requestAd) { resolve(); return; }
      // adError also fires when no ad was filled.
      ad.requestAd('midgame', { adFinished: () => resolve(), adError: () => resolve() });
    });
  },
  canReward: () => typeof sdk()?.ad?.requestAd === 'function',
  rewarded() {
    return new Promise<boolean>((resolve) => {
      const ad = sdk()?.ad;
      if (!ad?.requestAd) { resolve(false); return; }
      // Reward only on adFinished; adError (no fill, blocked, closed) gives nothing.
      ad.requestAd('rewarded', { adFinished: () => resolve(true), adError: () => resolve(false) });
    });
  },
  // CrazyGames takes no score from HTML5 games.
  canScore: () => false,
  score: () => Promise.resolve(false),
};
