// klyo (games.klyo.pl). SDK: https://games.klyo.pl/game-sdk/index.md
import type { PortalDriver } from '../portal/types';

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

const sdk = (): KlyoSdk | undefined => (typeof window !== 'undefined' ? window.klyo : undefined);

export const driver: PortalDriver = {
  name: 'klyo',
  present: () => !!sdk(),
  init(hooks) {
    sdk()?.onSound?.((soundOn) => hooks.setMuted(!soundOn));
  },
  ready() { sdk()?.ready?.(); },
  // klyo has no gameplay start/stop message.
  gameplay() {},
  adBreak() {
    return new Promise<void>((resolve) => {
      const k = sdk();
      if (!k?.adBreak) { resolve(); return; }
      // klyo's name for the break between rounds.
      k.adBreak('next', () => resolve());
    });
  },
  canReward: () => typeof sdk()?.rewardedAd === 'function',
  rewarded() {
    return new Promise<boolean>((resolve) => {
      const k = sdk();
      if (!k?.rewardedAd) { resolve(false); return; }
      k.rewardedAd((answer) => resolve(answer?.ok === true));
    });
  },
  canScore: () => typeof sdk()?.score === 'function',
  score(points) {
    return new Promise<boolean>((resolve) => {
      const k = sdk();
      if (!k?.score) { resolve(false); return; }
      k.score(points, (answer) => resolve(answer?.ok !== false));
    });
  },
};
