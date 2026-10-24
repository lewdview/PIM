export type SecretInput =
  | { kind: 'left' | 'right' | 'fire' | 'jump' | 'duck' }
  /** A tap or click, in canvas CSS pixels. */
  | { kind: 'pointer'; x: number; y: number; w: number; h: number };

/** A beat-driven secret level. The page owns the loop, input and music. */
export interface SecretGame {
  readonly title: string;
  readonly hint: string;
  /** Controls line shown under the hint when a gamepad is connected. */
  readonly padHint: string;
  /** Level ends (and is won if lives remain) at this beat. */
  readonly totalBeats: number;
  score: number;
  lives: number;
  done: boolean;
  won: boolean;
  update(beat: number, dt: number): void;
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, beat: number): void;
  input(action: SecretInput, beat: number): void;
}

/** Small seeded PRNG so every run of a level has the same layout. */
export function seeded(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Distance to the nearest whole beat, in beats (0 … 0.5). */
export function offBeat(beat: number) {
  return Math.abs(beat - Math.round(beat));
}
