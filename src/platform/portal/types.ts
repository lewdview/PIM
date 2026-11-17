/** What the game hands a portal driver when it starts. */
export interface PortalHooks {
  /** The portal's sound switch: true silences the game. */
  setMuted: (muted: boolean) => void;
  /** Ask gameplay to pause (the portal hid or covered the game). */
  pause: () => void;
}

/**
 * One portal's SDK behind the same few calls (see ./bridge). A driver must never
 * throw for a missing SDK method: it answers "nothing happened" instead.
 */
export interface PortalDriver {
  name: string;
  /** Has the portal's SDK script loaded? */
  present(): boolean;
  /** Start the SDK and wire the sound switch. */
  init(hooks: PortalHooks): Promise<void> | void;
  /** The first interactive screen is up. */
  ready(): void;
  /** A song started (true) or stopped (false). */
  gameplay(started: boolean): void;
  /** The ad break between rounds; resolves when it is over or there was none. */
  adBreak(): Promise<void>;
  canReward(): boolean;
  /** Resolves true only when the player earned the reward. */
  rewarded(): Promise<boolean>;
  canScore(): boolean;
  /** Resolves true once the portal has taken the score. */
  score(points: number): Promise<boolean>;
}
