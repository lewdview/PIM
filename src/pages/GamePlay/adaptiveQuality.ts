/**
 * Auto quality: watches real frame times during play and lowers the effective graphics
 * level when frames run long, then raises it again once the game runs smoothly.
 * It never goes above the player's own graphics setting.
 *
 * Levels follow GfxLevel: 3 ultra, 2 high, 1 medium, 0 low.
 */
import type { GfxLevel } from '@/lib/options';

const LEVELS: GfxLevel[] = ['low', 'medium', 'high', 'ultra'];
export const gfxRank = (g: GfxLevel | undefined): number => {
  const i = LEVELS.indexOf(g ?? 'high');
  return i < 0 ? 2 : i;
};
export const gfxAt = (rank: number): GfxLevel => LEVELS[Math.max(0, Math.min(3, rank))];

/** Frames are judged over windows this long. */
const WINDOW_MS = 2000;
/** A window with more than this share of long frames steps quality down. */
const DOWN_SLOW_SHARE = 0.12;
/** A window with less than this share counts as smooth. */
const UP_SLOW_SHARE = 0.03;
/** Smooth time needed before stepping up (longer when that level already failed once). */
const UP_AFTER_MS = 8000;
const UP_AFTER_RETRY_MS = 20000;
/** After any change, give the new level this long before judging it. */
const SETTLE_MS = 1500;
/** Gaps longer than this are pauses, tab switches or loads, not slow rendering. */
const STALL_MS = 250;
/**
 * A frame is slow when it misses 60fps by a clear margin (about one dropped frame).
 * Fixed rather than learned: learning the device's "normal" pace would treat a device
 * that is slow all the time as normal and never step down. 120Hz screens running a
 * steady 60 are not penalised.
 */
const SLOW_MS = 25;
/** A level that fails this many times in one song is not retried. */
const MAX_FAILS = 2;

export class AdaptiveQuality {
  /** Highest rank allowed right now (3 = no cap). */
  private cap = 3;
  private winStart = 0;
  private frames = 0;
  private slow = 0;
  private smoothSince = 0;
  private settleUntil = 0;
  /** How often each rank proved too heavy this song. */
  private fails = [0, 0, 0, 0];
  private lastFrameAt = 0;

  /** New song or restart: start again from the player's setting. */
  reset() {
    this.cap = 3;
    this.fails = [0, 0, 0, 0];
    this.pause();
  }

  /** Not playing (paused, countdown, results): drop the partial window, keep the level. */
  pause() {
    this.winStart = 0;
    this.frames = 0;
    this.slow = 0;
    this.smoothSince = 0;
    this.lastFrameAt = 0;
  }

  /**
   * Record one rendered frame. `targetMs` is the frame-rate cap's interval, or 0 for none.
   * Returns true when the effective level changed.
   */
  frame(now: number, userRank: number, targetMs: number): boolean {
    const prev = this.lastFrameAt;
    this.lastFrameAt = now;
    if (!prev) return false;
    const dt = now - prev;
    if (dt > STALL_MS || dt <= 0) {
      this.pause();
      this.lastFrameAt = now;
      return false;
    }
    if (now < this.settleUntil) return false;
    if (!this.winStart) this.winStart = now;

    this.frames++;
    // With a frame-rate cap (e.g. 30fps) a frame is slow when it overshoots the cap's interval.
    if (dt > Math.max(SLOW_MS, targetMs * 1.25)) this.slow++;

    if (now - this.winStart < WINDOW_MS) return false;
    return this.judge(now, userRank);
  }

  private judge(now: number, userRank: number): boolean {
    const share = this.frames ? this.slow / this.frames : 0;
    this.winStart = now;
    this.frames = 0;
    this.slow = 0;

    const eff = Math.min(this.cap, userRank);
    if (share > DOWN_SLOW_SHARE && eff > 0) {
      this.fails[eff]++;
      this.cap = eff - 1;
      this.changed(now);
      return true;
    }
    if (share < UP_SLOW_SHARE) {
      if (!this.smoothSince) this.smoothSince = now;
      const next = eff + 1;
      const wait = this.fails[next] ? UP_AFTER_RETRY_MS : UP_AFTER_MS;
      if (eff < userRank && this.fails[next] < MAX_FAILS && now - this.smoothSince >= wait) {
        this.cap = next;
        this.changed(now);
        return true;
      }
    } else {
      this.smoothSince = 0;
    }
    return false;
  }

  private changed(now: number) {
    this.settleUntil = now + SETTLE_MS;
    this.smoothSince = 0;
    this.winStart = 0;
    this.frames = 0;
    this.slow = 0;
  }

  /** The level to render at for a player whose own setting is `userRank`. */
  effective(userRank: number): number {
    return Math.min(this.cap, userRank);
  }
}
