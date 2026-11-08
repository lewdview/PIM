// Neon Reel notes: the showcase rhythm demo's look (components/showcase/scenes/RhythmScene)
// for every note type in the real game. Each note is a glowing rounded bar with a white
// highlight strip; special notes keep their meaning through their own colour, label and
// motion (REMIX, DROP, BEAT, WARP, LIFT, ZIGZAG, BURST, the AVOID mine, the see-through
// ghost; ZIGZAG shows its line instead of a label). Swipe directions, on taps, hold heads, slides and hold tails, get a thick
// animated double chevron in the strip's white.

import type { Note, NoteType } from '../../game/types';

let neonOn = false;

/** GameplayCore calls this whenever the HUD style changes. */
export function setNeonNotes(on: boolean) { neonOn = on; }
export function neonNotesOn() { return neonOn; }

/** Arrow direction → rotation, with the chevron drawn pointing up (−y) at 0. */
const SWIPE_ROT: Record<string, number> = {
  up: 0, 'up-right': Math.PI / 4, right: Math.PI / 2, 'down-right': (3 * Math.PI) / 4,
  down: Math.PI, 'down-left': (-3 * Math.PI) / 4, left: -Math.PI / 2, 'up-left': -Math.PI / 4,
};

/** Special-note palette, matching the colours the default renderer uses for each type. */
const SPECIAL: Partial<Record<NoteType | 'ghost', { color: string; label?: string }>> = {
  remix: { color: '#00F5D4', label: 'REMIX' },
  break: { color: '#FF7B00', label: 'DROP' },
  accent: { color: '#CCFF00', label: 'BEAT' },
  lift: { color: '#00FF88' },
  zigzag: { color: '#A855F7' },
  burst: { color: '#FF5500', label: 'BURST' },
};

const STRIP = 'rgba(255,255,255,0.95)';

/**
 * Draws one note centred on the current origin (drawKey has already translated there).
 * Always returns true: Neon Reel owns every note type.
 */
export function drawNeonKey(
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
  const w = noteW * 0.92;
  const h = Math.max(5, noteH * (isHold ? 0.55 : 0.64));

  ctx.save();
  try {
    if (noteType === 'mine') { drawMine(ctx, w, h, p, t); return true; }
    if ((noteType as string) === 'ghost') { drawGhost(ctx, w, h, laneColor, t); return true; }

    const isWarp = noteType === 'warp' || noteType === 'warp-clear';
    const special = noteType ? SPECIAL[noteType] : undefined;
    const color = isWarp ? `hsl(${(t * 220) % 360}, 100%, 62%)` : special?.color ?? laneColor;

    // BEAT notes thump on the beat; everything else holds its size.
    const scale = noteType === 'accent' ? 1 + 0.07 * Math.max(0, Math.sin(t * 9.4)) : 1;
    if (scale !== 1) ctx.scale(scale, scale);

    if (noteType === 'burst') drawBurstRays(ctx, w, h, color, t);
    if (isWarp) drawWarpRing(ctx, w, h, t);

    drawBar(ctx, w, h, color, p, isHold);

    if (noteType === 'zigzag') drawZigzag(ctx, w, h, t);
    if (noteType === 'remix') drawShimmer(ctx, w, h, t);

    // Direction arrows: swipes, hold-swipe and slide heads, and hold tails that end in a flick.
    const lift = noteType === 'lift' && (!swipeDirection || swipeDirection === 'up');
    if (swipeDirection && !lift) {
      drawArrow(ctx, w, h, swipeDirection, color, t);
    } else if (lift) {
      drawArrow(ctx, w, h, 'up', color, t);
    } else if (isHold) {
      drawHoldCap(ctx, h, color, t);
    }

    const label = isWarp ? (noteType === 'warp' ? 'WARP' : 'WARP ★') : special?.label;
    if (label && !isHold && !swipeDirection) drawLabel(ctx, w, h, label, color);
  } finally {
    ctx.restore();
  }
  return true;
}

/** The base bar: lane-coloured glow, inner shade and the white highlight strip. */
function drawBar(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, p: number, isHold: boolean) {
  const r = Math.min(h / 2, 10);
  ctx.save();
  ctx.globalAlpha = isHold ? 0.78 : 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10 + 18 * p;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;

  const shade = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  shade.addColorStop(0, 'rgba(255,255,255,0.18)');
  shade.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = shade;
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + Math.min(6, w * 0.06), -h / 2 + Math.max(1.5, h * 0.12), w - Math.min(12, w * 0.12), Math.max(1.5, h * 0.18), 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Thick double chevron in the strip's white, glowing in the note colour. The pair marches
 * toward the swipe direction and fades as it goes, so the direction reads at a glance.
 */
function drawArrow(ctx: CanvasRenderingContext2D, w: number, h: number, dir: string, color: string, t: number) {
  const s = Math.max(8, Math.min(h * 1.15, w * 0.34));
  const travel = s * 0.42;
  ctx.save();
  ctx.rotate(SWIPE_ROT[dir] ?? 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, s * 0.3);
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  for (let i = 0; i < 2; i++) {
    const k = ((t * 1.8) + i / 2) % 1;            // 0 → 1 along the direction
    const y = travel * 0.5 - k * travel * 1.6;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.95 + 0.05;
    ctx.strokeStyle = STRIP;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, y + s * 0.26);
    ctx.lineTo(0, y - s * 0.26);
    ctx.lineTo(s * 0.5, y + s * 0.26);
    ctx.stroke();
  }
  ctx.restore();
}

/** End of a plain hold: a white core with a ring that breathes. */
function drawHoldCap(ctx: CanvasRenderingContext2D, h: number, color: string, t: number) {
  const core = Math.max(3, h * 0.22);
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = STRIP;
  ctx.beginPath();
  ctx.arc(0, 0, core, 0, Math.PI * 2);
  ctx.fill();
  const k = (t * 1.6) % 1;
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = STRIP;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, core + k * h * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Anton label sitting on the bar, dark with a white edge so it reads on any colour. */
function drawLabel(ctx: CanvasRenderingContext2D, w: number, h: number, label: string, color: string) {
  const size = Math.min(h * 0.62, (w * 0.82) / (label.length * 0.62));
  if (size < 7) return;
  ctx.save();
  ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.18);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeText(label, 0, size * 0.04);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b0710';
  ctx.fillText(label, 0, size * 0.04);
  ctx.restore();
}

/** REMIX: a bright band sweeps across the bar. */
function drawShimmer(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const x = -w / 2 + ((t * 0.9) % 1) * w * 1.4 - w * 0.2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(h / 2, 10));
  ctx.clip();
  const g = ctx.createLinearGradient(x - w * 0.15, 0, x + w * 0.15, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

/** WARP: two counter-spinning dashed rings behind the bar. */
function drawWarpRing(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const r = Math.max(h, w * 0.32);
  ctx.save();
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.rotate((i ? -1 : 1) * t * (i ? 2.2 : 3.4));
    ctx.setLineDash([r * 0.5, r * 0.32]);
    ctx.strokeStyle = `hsla(${(t * 220 + i * 120) % 360}, 100%, 65%, 0.85)`;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (1 + i * 0.22), r * 0.55 * (1 + i * 0.22), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** BURST: short rays pulsing out from the bar. */
function drawBurstRays(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, t: number) {
  const k = (t * 2.2) % 1;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, h * 0.12);
  ctx.globalAlpha = 1 - k;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rx = w * 0.5 + 4 + k * h * 0.9, ry = h * 0.5 + 4 + k * h * 0.9;
    const x0 = Math.cos(a) * (w * 0.5), y0 = Math.sin(a) * (h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(Math.cos(a) * rx, Math.sin(a) * ry);
    ctx.stroke();
  }
  ctx.restore();
}

/** ZIGZAG: a white zigzag line running along the bar. */
function drawZigzag(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const steps = 6;
  const amp = h * 0.24;
  const shift = (t * 3) % 2;
  ctx.save();
  ctx.strokeStyle = STRIP;
  ctx.lineWidth = Math.max(2, h * 0.12);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const x = -w * 0.4 + (i / steps) * w * 0.8;
    const y = ((i + Math.floor(shift)) % 2 ? -amp : amp);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** MINE: a red hazard plate with warning stripes, a skull and AVOID, pulsing. */
function drawMine(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) {
  const pulse = 1 + 0.08 * Math.sin(t * 11);
  const mw = w * 0.86 * pulse, mh = h * 1.1 * pulse;
  const r = Math.min(mh / 2, 10);
  ctx.save();
  ctx.shadowColor = '#FF003C';
  ctx.shadowBlur = 16 + 18 * p;
  ctx.fillStyle = '#1a0006';
  ctx.beginPath();
  ctx.roundRect(-mw / 2, -mh / 2, mw, mh, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,0,60,0.55)';
  ctx.lineWidth = Math.max(3, mh * 0.18);
  const off = (t * 40) % (mh * 0.7);
  for (let x = -mw; x < mw; x += mh * 0.7) {
    ctx.beginPath();
    ctx.moveTo(x + off, mh / 2);
    ctx.lineTo(x + off + mh, -mh / 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#FF003C';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#FF003C';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(-mw / 2, -mh / 2, mw, mh, r);
  ctx.stroke();
  ctx.shadowBlur = 0;
  const size = Math.min(mh * 0.62, mw * 0.16);
  if (size >= 7) {
    ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFE4E9';
    ctx.shadowColor = '#FF003C';
    ctx.shadowBlur = 10;
    ctx.fillText('☠ AVOID', 0, size * 0.05);
  }
  ctx.restore();
}

/** GHOST: an outline-only bar that flickers, so it reads as "not really there". */
function drawGhost(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, t: number) {
  const r = Math.min(h / 2, 10);
  ctx.save();
  ctx.globalAlpha = 0.45 + 0.25 * Math.sin(t * 7);
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -t * 30;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, r);
  ctx.stroke();
  ctx.restore();
}
