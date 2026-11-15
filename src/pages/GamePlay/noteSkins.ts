// Note skins. A skin is the art a note is drawn with; it is its own setting (Options →
// Display → Notes), separate from the HUD style. 'match' follows the HUD: Poetic GUI → ink on paper slips (inkNotes), Console Rail → LED
// chips (railNotes), Beta → the original piano key drawn by GameplayCore.drawKey. Vinyl
// (vinylNotes) belongs to no HUD and is only ever picked by hand. Every skin draws the same
// strike line through the note's middle (noteStrike).

import type { Note, NoteType } from '../../game/types';
import type { HudStyle, NoteSkin } from '../../lib/options';
import { drawNeonKey } from './neonNotes';
import { drawInkKey } from './inkNotes';
import { drawRailKey } from './railNotes';
import { drawVinylKey } from './vinylNotes';
import { gateShadows, shadowScaleOf } from './shadowGate';

type SkinFn = (
  ctx: CanvasRenderingContext2D,
  noteW: number,
  noteH: number,
  laneColor: string,
  prog: number,
  isHold: boolean,
  swipeDirection: Note['swipeDirection'] | undefined,
  noteType: NoteType | undefined,
  timeOffset?: number,
) => boolean;

/** A skin that is actually drawn: everything except 'match'. */
export type DrawnNoteSkin = Exclude<NoteSkin, 'match'>;

/** 'classic' has no entry: GameplayCore.drawKey draws it itself. */
const SKINS: Partial<Record<DrawnNoteSkin, SkinFn>> = {
  neon: drawNeonKey,
  ink: drawInkKey,
  rail: drawRailKey,
  vinyl: drawVinylKey,
};

/** The skin each HUD style brings with it when the player leaves Note skin on 'match'. */
const HUD_SKIN: Record<HudStyle, DrawnNoteSkin> = {
  stanza: 'ink',
  console: 'rail',
  beta: 'classic',
};

/** The skin to draw for a player's settings. */
export function resolveNoteSkin(skin: NoteSkin | null | undefined, hudStyle: HudStyle | null | undefined): DrawnNoteSkin {
  return skin && skin !== 'match' ? skin : HUD_SKIN[hudStyle ?? 'console'];
}

let active: SkinFn | null = null;
let activeId: DrawnNoteSkin | null = null;

/** GameplayCore calls this whenever the note skin or HUD style changes (null on unmount). */
export function setNoteSkin(skin: DrawnNoteSkin | null) {
  active = (skin && SKINS[skin]) || null;
  activeId = active ? skin : null;
  sprites.clear();
}

// ── Sprite cache ──
// Most notes on screen are plain taps and hold heads, and their art has no moving parts: it
// depends only on the skin, the colour, the size and how close the note is. Drawing each one
// from scratch every frame (gradients, clips, a blurred glow) is what made a busy chart
// stutter, so a still note is drawn once into a small off-screen canvas and stamped from
// there. Notes that animate (arrows, hold ends, REMIX, BEAT, WARP, mines and the rest) are
// still drawn live; there are only ever a few of those on screen.

type Sprite = { canvas: HTMLCanvasElement; w: number; h: number };
const sprites = new Map<string, Sprite>();
const MAX_SPRITES = 260;
const PAD_X = 20; // room for the bloom and the strike sights
const PAD_Y = 22;
/** Note types whose art moves (or, for mines and ghosts, pulses). Every other type is a still bar. */
const MOVING_TYPES: ReadonlySet<string> = new Set(['mine', 'ghost', 'warp', 'warp-clear', 'remix', 'accent', 'lift', 'zigzag', 'burst']);

function stillSprite(
  ctx: CanvasRenderingContext2D, noteW: number, noteH: number, laneColor: string, prog: number, noteType: NoteType | undefined,
): { sprite: Sprite; bw: number; bh: number } | null {
  if (!active || typeof document === 'undefined') return null;
  // Sizes are snapped so that neighbouring notes share a sprite; it is stretched the last
  // few pixels when stamped.
  const bw = Math.max(48, Math.ceil(noteW / 24) * 24);
  const bh = Math.max(8, Math.round((noteH / noteW) * 40) / 40 * bw);
  const p = Math.round(Math.max(0, Math.min(1, prog)) * 6) / 6;
  const m = ctx.getTransform();
  const res = Math.max(1, Math.min(3, Math.round(Math.hypot(m.a, m.b) * 2) / 2)); // device pixels per unit
  const glow = shadowScaleOf(ctx);
  const key = `${activeId}|${noteType ?? ''}|${bw}|${bh}|${laneColor}|${p}|${res}|${glow}`;
  let sprite = sprites.get(key);
  if (sprite) {
    // Refresh its place in the eviction order.
    sprites.delete(key);
    sprites.set(key, sprite);
    return { sprite, bw, bh };
  }
  const w = bw + PAD_X * 2, h = bh + PAD_Y * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * res);
  canvas.height = Math.ceil(h * res);
  const sctx = canvas.getContext('2d');
  if (!sctx) return null;
  gateShadows(sctx, glow);
  sctx.scale(res, res);
  sctx.translate(w / 2, h / 2);
  active(sctx, bw, bh, laneColor, p, false, undefined, noteType, 0);
  sprite = { canvas, w, h };
  sprites.set(key, sprite);
  if (sprites.size > MAX_SPRITES) sprites.delete(sprites.keys().next().value as string);
  return { sprite, bw, bh };
}

/** Draws the note with the active skin. False when the original renderer should draw it. */
export const drawSkinnedKey: SkinFn = (ctx, noteW, noteH, laneColor, prog, isHold, swipeDirection, noteType, timeOffset) => {
  if (!active) return false;
  const still = !isHold && !swipeDirection && (noteType === undefined || !MOVING_TYPES.has(noteType));
  if (still && noteW > 0 && noteH > 0) {
    const hit = stillSprite(ctx, noteW, noteH, laneColor, prog, noteType);
    if (hit) {
      const kx = noteW / hit.bw, ky = noteH / hit.bh;
      const w = hit.sprite.w * kx, h = hit.sprite.h * ky;
      ctx.drawImage(hit.sprite.canvas, -w / 2, -h / 2, w, h);
      return true;
    }
  }
  return active(ctx, noteW, noteH, laneColor, prog, isHold, swipeDirection, noteType, timeOffset);
};
