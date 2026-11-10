// Ink notes: the Poetic GUI's own note skin. Each note is a paper slip with a tapered black
// brush stroke and a small seal in the lane colour, so the highway reads like a page being
// inked. Special notes keep their meaning as red-seal stamps (REMIX, DROP, BEAT, WARP,
// BURST), the mine is an ink blot marked AVOID, the ghost a faint pencil outline. Swipe
// directions on taps, slide heads and hold tails get a brush chevron that sweeps toward the
// swipe; hold heads stay plain, and hold ends get a breathing ensō circle.

import type { Note, NoteType } from '../../game/types';
import { SWIPE_ROT, SPECIAL } from './neonNotes';

const PAPER = '#f3ede1';
const PAPER_EDGE = '#d9cfbd';
const INK = '#16120e';
const SEAL = '#c8102e';

export function drawInkKey(
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
  const w = noteW * 0.9;
  const h = Math.max(6, noteH * (isHold ? 0.55 : 0.66));

  ctx.save();
  try {
    if (noteType === 'mine') { drawBlot(ctx, w, h, t); return true; }
    if ((noteType as string) === 'ghost') { drawPencil(ctx, w, h, t); return true; }

    const isWarp = noteType === 'warp' || noteType === 'warp-clear';
    const special = noteType ? SPECIAL[noteType] : undefined;
    const accent = isWarp ? `hsl(${(t * 200) % 360}, 90%, 55%)` : special?.color ?? laneColor;

    const scale = noteType === 'accent' ? 1 + 0.06 * Math.max(0, Math.sin(t * 9.4)) : 1;
    if (scale !== 1) ctx.scale(scale, scale);

    if (noteType === 'burst') drawSplatter(ctx, w, h, t);
    if (isWarp) drawWash(ctx, w, h, t);

    drawSlip(ctx, w, h, accent, p, isHold);
    if (noteType === 'zigzag') drawInkZigzag(ctx, w, h, t);
    else drawStroke(ctx, w, h, noteType === 'accent' ? 1.25 : 1);
    if (noteType === 'remix') drawWetSheen(ctx, w, h, t);

    const lift = noteType === 'lift' && (!swipeDirection || swipeDirection === 'up');
    const holdHead = !isHold && (noteType === 'hold' || noteType === 'hold-swipe');
    if (swipeDirection && !lift && !holdHead) drawBrushChevron(ctx, w, h, swipeDirection, accent, t);
    else if (lift) drawBrushChevron(ctx, w, h, 'up', accent, t);
    else if (isHold) drawEnso(ctx, h, accent, t);

    const label = isWarp ? (noteType === 'warp' ? 'WARP' : 'WARP ★') : special?.label;
    if (label && !isHold && !swipeDirection) drawStamp(ctx, w, h, label, special ? SEAL : accent);
  } finally {
    ctx.restore();
  }
  return true;
}

/** Paper slip: warm off-white card, deckled bottom edge, lane colour bleeding up from below. */
function drawSlip(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string, p: number, isHold: boolean) {
  const x = -w / 2, y = -h / 2;
  ctx.save();
  ctx.globalAlpha = isHold ? 0.82 : 1;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 6 + 6 * p;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // Lane colour soaks up from the bottom edge like ink into paper.
  const soak = ctx.createLinearGradient(0, y + h, 0, y);
  soak.addColorStop(0, accent);
  soak.addColorStop(0.45, 'rgba(255,255,255,0)');
  ctx.globalAlpha = (isHold ? 0.82 : 1) * 0.55;
  ctx.fillStyle = soak;
  ctx.fill();
  ctx.globalAlpha = isHold ? 0.82 : 1;
  ctx.strokeStyle = PAPER_EDGE;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Seal: a small square chop in the lane colour, right end.
  const s = Math.min(h * 0.42, w * 0.1);
  if (s >= 4) {
    ctx.save();
    ctx.translate(x + w - s * 0.95, y + h * 0.5);
    ctx.rotate(-0.08);
    ctx.fillStyle = accent;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.strokeRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6);
    ctx.restore();
  }
  ctx.restore();
}

/** Tapered brush stroke across the slip: thin entry, full belly, dry-brush exit. */
function drawStroke(ctx: CanvasRenderingContext2D, w: number, h: number, weight: number) {
  const L = -w * 0.38, R = w * 0.28;
  const th = Math.max(2, h * 0.3 * weight);
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(L, h * 0.04);
  ctx.quadraticCurveTo(L + (R - L) * 0.3, -th * 0.75, R, -th * 0.2);
  ctx.quadraticCurveTo(R + th * 0.5, 0, R - th * 0.2, th * 0.35);
  ctx.quadraticCurveTo(L + (R - L) * 0.45, th * 0.8, L, h * 0.08);
  ctx.closePath();
  ctx.fill();
  // Dry-brush streaks off the tail.
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(0.8, th * 0.12);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(R - th * 0.4, i * th * 0.22);
    ctx.lineTo(R + th * (0.7 + 0.25 * (1 - Math.abs(i))), i * th * 0.28);
    ctx.stroke();
  }
  ctx.restore();
}

/** Brush chevron in ink with a lane-colour underpaint; two strokes sweep toward the swipe. */
function drawBrushChevron(ctx: CanvasRenderingContext2D, w: number, h: number, dir: string, accent: string, t: number) {
  const s = Math.max(9, Math.min(h * 1.2, w * 0.34));
  const travel = s * 0.45;
  ctx.save();
  ctx.rotate(SWIPE_ROT[dir] ?? 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';
  for (let i = 0; i < 2; i++) {
    const k = (t * 1.6 + i / 2) % 1;
    const y = travel * 0.5 - k * travel * 1.6;
    const a = Math.sin(k * Math.PI) * 0.95 + 0.05;
    // Underpaint (lane colour), then the ink stroke on top, slightly offset like a hand print.
    ctx.globalAlpha = a * 0.85;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(4, s * 0.42);
    chevron(ctx, s, y + s * 0.04);
    ctx.globalAlpha = a;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(3, s * 0.24);
    chevron(ctx, s, y);
  }
  ctx.restore();
}
function chevron(ctx: CanvasRenderingContext2D, s: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(-s * 0.48, y + s * 0.26);
  ctx.lineTo(0, y - s * 0.24);
  ctx.lineTo(s * 0.48, y + s * 0.26);
  ctx.stroke();
}

/** Hold end: an ensō (open brush circle) that slowly turns and breathes. */
function drawEnso(ctx: CanvasRenderingContext2D, h: number, accent: string, t: number) {
  const r = Math.max(4, h * 0.36) * (1 + 0.08 * Math.sin(t * 4));
  ctx.save();
  ctx.rotate(t * 1.2);
  ctx.lineCap = 'round';
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(3, r * 0.55);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0.2, Math.PI * 1.8);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, r * 0.32);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0.35, Math.PI * 1.75);
  ctx.stroke();
  ctx.restore();
}

/** Red seal stamp with the label in serif caps, sitting over the stroke. */
function drawStamp(ctx: CanvasRenderingContext2D, w: number, h: number, label: string, color: string) {
  const size = Math.min(h * 0.5, (w * 0.62) / (label.length * 0.62));
  if (size < 7) return;
  ctx.save();
  ctx.font = `700 ${size}px "Instrument Serif", Georgia, serif`;
  const tw = ctx.measureText(label).width;
  const bw = tw + size * 0.9, bh = size * 1.35;
  ctx.rotate(-0.06);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.strokeRect(-bw / 2 + size * 0.14, -bh / 2 + size * 0.14, bw - size * 0.28, bh - size * 0.28);
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, size * 0.06);
  ctx.restore();
}

/** REMIX: wet ink sheen gliding across the stroke. */
function drawWetSheen(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const x = -w / 2 + ((t * 0.8) % 1) * w * 1.4 - w * 0.2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 3);
  ctx.clip();
  const g = ctx.createLinearGradient(x - w * 0.12, 0, x + w * 0.12, 0);
  g.addColorStop(0, 'rgba(0,245,212,0)');
  g.addColorStop(0.5, 'rgba(0,245,212,0.55)');
  g.addColorStop(1, 'rgba(0,245,212,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

/** WARP: watercolour bloom in shifting hues bleeding out behind the slip. */
function drawWash(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const a = t * 1.3 + (i * Math.PI * 2) / 3;
    const g = ctx.createRadialGradient(Math.cos(a) * w * 0.2, Math.sin(a) * h * 0.4, 0, 0, 0, Math.max(w * 0.6, h));
    g.addColorStop(0, `hsla(${(t * 200 + i * 120) % 360}, 90%, 60%, 0.45)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w, -h * 1.6, w * 2, h * 3.2);
  }
  ctx.restore();
}

/** BURST: ink splatter flicked outward, reforming each beat. */
function drawSplatter(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const k = (t * 2) % 1;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.85 * (1 - k);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.39996; // golden angle: an organic, uneven spray
    const d = 0.55 + k * 0.6 + (i % 3) * 0.08;
    const r = Math.max(1, h * (0.08 + (i % 4) * 0.03) * (1 - k * 0.5));
    ctx.beginPath();
    ctx.arc(Math.cos(a) * w * 0.5 * d, Math.sin(a) * h * 0.9 * d, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** ZIGZAG: a brushed zigzag line instead of the straight stroke. */
function drawInkZigzag(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const steps = 6, amp = h * 0.24, shift = Math.floor((t * 3) % 2);
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, h * 0.16);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const x = -w * 0.38 + (i / steps) * w * 0.66;
    const y = (i + shift) % 2 ? -amp : amp;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** MINE: a spreading ink blot with a red cross and AVOID. */
function drawBlot(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const pulse = 1 + 0.07 * Math.sin(t * 10);
  const rx = w * 0.42 * pulse, ry = h * 0.62 * pulse;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wob = 1 + 0.12 * Math.sin(i * 3.7 + t * 2);
    const x = Math.cos(a) * rx * wob, y = Math.sin(a) * ry * wob;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.shadowColor = SEAL;
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = SEAL;
  ctx.lineWidth = Math.max(2.5, ry * 0.2);
  ctx.lineCap = 'round';
  const c = Math.min(rx, ry) * 0.45;
  ctx.beginPath();
  ctx.moveTo(-rx * 0.62 - c * 0.5, -c); ctx.lineTo(-rx * 0.62 + c * 0.5, c);
  ctx.moveTo(-rx * 0.62 + c * 0.5, -c); ctx.lineTo(-rx * 0.62 - c * 0.5, c);
  ctx.stroke();
  const size = Math.min(ry * 0.9, rx * 0.34);
  if (size >= 7) {
    ctx.font = `700 ${size}px "Instrument Serif", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PAPER;
    ctx.fillText('AVOID', rx * 0.12, size * 0.05);
  }
  ctx.restore();
}

/** GHOST: a faint graphite outline, sketched but never inked. */
function drawPencil(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.save();
  ctx.globalAlpha = 0.4 + 0.2 * Math.sin(t * 6);
  ctx.strokeStyle = '#b9b2a6';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  ctx.lineDashOffset = -t * 20;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.setLineDash([]);
  ctx.globalAlpha *= 0.6;
  ctx.strokeRect(-w / 2 + 2, -h / 2 + 1.5, w - 3, h - 2);
  ctx.restore();
}
