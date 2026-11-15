// Vinyl notes: each note is a strip of pressed record. Black lacquer with fine grooves ringing
// out from the middle, a sheen that turns slowly across it, a lit rim in the lane colour and a
// paper label at the centre with its spindle hole. The strike line (see ./noteStrike) is the
// needle's path: a lane-colour line straight through the spindle. Special notes, arrows, hold
// ends, mines and ghosts share the Neon Reel's marks so every type still reads the same way.

import type { Note, NoteType } from '../../game/types';
import {
  SPECIAL, drawArrow, drawBurstRays, drawGhost, drawHoldCap, drawLabel, drawMine, drawWarpRing, drawZigzag,
} from './neonNotes';
import { drawStrike } from './noteStrike';

const LACQUER = '#07070a';
const LACQUER_HI = '#23232b';

export function drawVinylKey(
  ctx: CanvasRenderingContext2D,
  noteW: number,
  noteH: number,
  laneColor: string,
  prog: number,
  isHold: boolean,
  swipeDirection: Note['swipeDirection'] | undefined,
  noteType: NoteType | undefined,
  timeOffset = 0,
): boolean {
  const t = (performance.now() + timeOffset) / 1000;
  const p = Math.max(0, Math.min(1, prog));
  const w = noteW * 0.88; // leaves room for the strike sights inside the lane
  const h = Math.max(6, noteH * (isHold ? 0.55 : 0.66));

  ctx.save();
  try {
    if (noteType === 'mine') { drawMine(ctx, w, h, p, t); return true; }
    if ((noteType as string) === 'ghost') { drawGhost(ctx, w, h, laneColor, t); return true; }

    const isWarp = noteType === 'warp' || noteType === 'warp-clear';
    const special = noteType ? SPECIAL[noteType] : undefined;
    const color = isWarp ? `hsl(${(t * 220) % 360}, 100%, 62%)` : special?.color ?? laneColor;

    // BEAT notes thump on the beat, like a kick through the platter.
    const scale = noteType === 'accent' ? 1 + 0.07 * Math.max(0, Math.sin(t * 9.4)) : 1;
    if (scale !== 1) ctx.scale(scale, scale);

    if (noteType === 'burst') drawBurstRays(ctx, w, h, color, t);
    if (isWarp) drawWarpRing(ctx, w, h, t);

    const lift = noteType === 'lift' && (!swipeDirection || swipeDirection === 'up');
    const holdHead = !isHold && (noteType === 'hold' || noteType === 'hold-swipe');
    const arrow = swipeDirection && !lift && !holdHead ? swipeDirection : lift ? 'up' : null;
    const label = isWarp ? (noteType === 'warp' ? 'WARP' : 'WARP ★') : special?.label;
    const showLabel = !!label && !isHold && !swipeDirection;

    drawPressing(ctx, w, h, color, p, isHold, t, noteType === 'remix');
    // The centre label steps aside when an arrow, hold end or printed word takes the middle.
    if (!arrow && !isHold && !showLabel && noteType !== 'zigzag') drawCentreLabel(ctx, h, color);
    drawStrike(ctx, w, h, color, p, { core: color, inset: h * 0.5, glow: false, weight: Math.max(1.5, h * 0.07) });
    if (!arrow && !isHold && !showLabel && noteType !== 'zigzag') drawSpindle(ctx, h);

    if (noteType === 'zigzag') drawZigzag(ctx, w, h, t);
    if (arrow) drawArrow(ctx, w, h, arrow, color, t);
    else if (isHold) drawHoldCap(ctx, h, color, t);
    if (showLabel) drawLabel(ctx, w, h, label!, color);
  } finally {
    ctx.restore();
  }
  return true;
}

/** The record strip: lacquer body, grooves, a turning sheen and a rim lit in the note colour. */
function drawPressing(
  ctx: CanvasRenderingContext2D, w: number, h: number, color: string, p: number, isHold: boolean, t: number, fast: boolean,
) {
  const r = h / 2;
  const x = -w / 2, y = -h / 2;
  ctx.save();
  ctx.globalAlpha = isHold ? 0.82 : 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 + 16 * p;
  const body = ctx.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, LACQUER_HI);
  body.addColorStop(0.5, LACQUER);
  body.addColorStop(1, '#15151b');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.clip();
  // Grooves: rings spreading out from the spindle, as the record would show them.
  ctx.lineWidth = 0.7;
  const step = Math.max(4, h * 0.2);
  for (let rx = h * 0.62, i = 0; rx < w / 2 + h; rx += step, i++) {
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, rx * 0.82, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Sheen: two opposite wedges of light. Still on ordinary notes (so their art can be drawn
  // once and reused); it turns on REMIX notes.
  const a = fast ? t * 2.6 : 0.5;
  for (const s of [0, Math.PI]) {
    const g = ctx.createLinearGradient(0, 0, Math.cos(a + s) * w * 0.5, Math.sin(a + s) * h * 1.6);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, fast ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();

  // Rim in the note colour, brighter as the note arrives.
  ctx.globalAlpha *= 0.6 + 0.4 * p;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, h * 0.07);
  ctx.beginPath();
  ctx.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, r);
  ctx.stroke();
  ctx.restore();
}

/** The paper label at the centre of the record, in the note colour with a pale ring. */
function drawCentreLabel(ctx: CanvasRenderingContext2D, h: number, color: string) {
  const r = h * 0.36;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  const shade = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 0, 0, 0, r);
  shade.addColorStop(0, 'rgba(255,255,255,0.35)');
  shade.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(0.8, r * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** The spindle hole, drawn over the strike line so the line reads as passing through it. */
function drawSpindle(ctx: CanvasRenderingContext2D, h: number) {
  ctx.save();
  ctx.fillStyle = '#050507';
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.5, h * 0.075), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}
