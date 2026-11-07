// Neon Reel note heads: the look of the showcase rhythm demo (components/showcase/scenes/
// RhythmScene) inside the real game. A glowing rounded bar in the lane's colour with a white
// top highlight, and a dark chevron for swipes. drawKey hands standard notes here while the
// Neon Reel HUD is on; mines, ghosts, remix, warp and the other special notes keep their own
// art so what they mean stays readable.

import type { Note, NoteType } from '../../game/types';

let neonOn = false;

/** GameplayCore calls this whenever the HUD style changes. */
export function setNeonNotes(on: boolean) { neonOn = on; }
export function neonNotesOn() { return neonOn; }

const NEON_TYPES = new Set<NoteType | undefined>([undefined, 'tap', 'hold', 'swipe', 'hold-swipe', 'double', 'slide'] as Array<NoteType | undefined>);

const SWIPE_ROT: Record<string, number> = {
  up: 0, 'up-right': Math.PI / 4, right: Math.PI / 2, 'down-right': (3 * Math.PI) / 4,
  down: Math.PI, 'down-left': (-3 * Math.PI) / 4, left: -Math.PI / 2, 'up-left': -Math.PI / 4,
};

/**
 * Draws one note head centred on the current origin (drawKey has already translated there).
 * Returns false for note types it leaves to the default renderer.
 */
export function drawNeonKey(
  ctx: CanvasRenderingContext2D,
  noteW: number,
  noteH: number,
  color: string,
  prog: number,
  isHold: boolean,
  swipeDirection: Note['swipeDirection'] | undefined,
  noteType: NoteType | undefined,
): boolean {
  if (!NEON_TYPES.has(noteType)) return false;
  const p = Math.max(0, Math.min(1, prog));
  const w = noteW * 0.92;
  const h = Math.max(4, noteH * (isHold ? 0.55 : 0.62));
  const r = Math.min(h / 2, 10);

  // Body with lane-coloured glow; hold tails are softer so the head reads first.
  ctx.save();
  ctx.globalAlpha = isHold ? 0.75 : 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10 + 18 * p;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Inner shade so the bar has depth without a 3D slab.
  const shade = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  shade.addColorStop(0, 'rgba(255,255,255,0.18)');
  shade.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = shade;
  ctx.fill();

  // White top highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + Math.min(6, w * 0.06), -h / 2 + Math.max(1.5, h * 0.12), w - Math.min(12, w * 0.12), Math.max(1.5, h * 0.2), 2);
  ctx.fill();

  // Swipe chevron.
  if (swipeDirection && !isHold && (noteType === 'swipe' || noteType === undefined || noteType === 'tap')) {
    const s = Math.min(h * 0.95, w * 0.32);
    ctx.rotate(SWIPE_ROT[swipeDirection] ?? 0);
    ctx.strokeStyle = '#0b0710';
    ctx.lineWidth = Math.max(2, s * 0.24);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.28);
    ctx.lineTo(0, -s * 0.28);
    ctx.lineTo(s * 0.55, s * 0.28);
    ctx.stroke();
  }
  ctx.restore();
  return true;
}
