/**
 * Motion trails: a soft streak behind each falling note, pointing back along its path.
 *
 * Built for frame rate:
 * - The streak is one pre-rendered sprite per colour, drawn with a single drawImage.
 *   No gradients, paths or shadowBlur are created per note per frame.
 * - The tail comes from the same projection the note uses, a moment earlier in its
 *   approach, so it follows the track in every POV (classic, tunnels, spirals...).
 * - Nothing persists between frames: no trail buffer, no fading canvas, no allocations.
 *   That also suits the main canvas, which is transparent over the CSS background, so
 *   the usual "paint a translucent black rect each frame" trick can't be used.
 */
import { colorWithAlpha } from './colorUtils';
import type { GfxLevel } from '@/lib/options';

const SPRITE_W = 32;
const SPRITE_H = 128;
/** Colours come from the cover art, so the cache stays small; cleared if it grows. */
const MAX_SPRITES = 24;
const sprites = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Sprite layout: tail (transparent) at the top, head (strongest) at the bottom. */
function trailSprite(color: string): HTMLCanvasElement | OffscreenCanvas | null {
  const hit = sprites.get(color);
  if (hit) return hit;
  if (sprites.size >= MAX_SPRITES) sprites.clear();

  const c = makeCanvas(SPRITE_W, SPRITE_H);
  const g = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!g) return null;

  // Colour body, fading in from the tail.
  const body = g.createLinearGradient(0, 0, 0, SPRITE_H);
  body.addColorStop(0, colorWithAlpha(color, 0));
  body.addColorStop(0.55, colorWithAlpha(color, 0.35));
  body.addColorStop(1, colorWithAlpha(color, 0.9));
  g.fillStyle = body;
  g.fillRect(0, 0, SPRITE_W, SPRITE_H);

  // Soft sides, tapering toward the tail.
  g.globalCompositeOperation = 'destination-in';
  const sides = g.createLinearGradient(0, 0, SPRITE_W, 0);
  sides.addColorStop(0, 'rgba(0,0,0,0)');
  sides.addColorStop(0.5, 'rgba(0,0,0,1)');
  sides.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sides;
  g.beginPath();
  g.moveTo(SPRITE_W * 0.38, 0);
  g.lineTo(SPRITE_W * 0.62, 0);
  g.lineTo(SPRITE_W, SPRITE_H);
  g.lineTo(0, SPRITE_H);
  g.closePath();
  g.fill();

  // Bright core so the streak reads as speed, not smoke.
  g.globalCompositeOperation = 'lighter';
  const core = g.createLinearGradient(0, 0, 0, SPRITE_H);
  core.addColorStop(0, 'rgba(255,255,255,0)');
  core.addColorStop(1, 'rgba(255,255,255,0.45)');
  g.fillStyle = core;
  g.fillRect(SPRITE_W * 0.44, SPRITE_H * 0.2, SPRITE_W * 0.12, SPRITE_H * 0.8);

  sprites.set(color, c);
  return c;
}

export interface MotionTrailLook {
  /** How far back along the approach the tail starts, in seconds of travel. */
  seconds: number;
  /** Streak opacity at the head. */
  alpha: number;
}

/**
 * Trail settings for the current graphics level, or null when trails are off.
 * Low graphics, legacy graphics and minimal particles turn them off, so auto quality
 * removes them first when a device struggles.
 */
export function motionTrailLook(gfx: GfxLevel, legacy: boolean, particles: string): MotionTrailLook | null {
  if (legacy || gfx === 'low' || particles === 'minimal') return null;
  if (gfx === 'medium' || particles === 'half') return { seconds: 0.09, alpha: 0.45 };
  if (gfx === 'ultra') return { seconds: 0.17, alpha: 0.72 };
  return { seconds: 0.14, alpha: 0.65 };
}

/**
 * Draw one streak from the note's earlier position (tail) to its current centre (head).
 * Call before the note itself so the note sits on top.
 */
export function drawMotionTrail(
  ctx: CanvasRenderingContext2D,
  color: string,
  headX: number,
  headY: number,
  tailX: number,
  tailY: number,
  width: number,
  alpha: number,
  overlap: number,
): void {
  const vx = tailX - headX;
  const vy = tailY - headY;
  const len = Math.hypot(vx, vy);
  if (!(len > 2) || !(width > 0) || alpha <= 0.01) return;
  const sprite = trailSprite(color);
  if (!sprite) return;

  // Unit vector toward the tail and its perpendicular: sprite "up" points at the tail.
  const ux = vx / len;
  const uy = vy / len;
  const prevAlpha = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = prevAlpha * alpha;
  ctx.transform(-uy, ux, -ux, -uy, headX, headY);
  ctx.drawImage(sprite as CanvasImageSource, -width / 2, -len, width, len + overlap);
  ctx.restore();
}
