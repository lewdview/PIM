// Rail notes: the Console Rail's own note skin. Each note is a cut-corner chip of brushed
// gunmetal with lane-colour edge lights and an LED bar split along its middle by a lit
// groove. The groove is the strike line (see ./noteStrike); the segments either side charge
// up as the note nears the hit line, so timing reads off the note itself. Special notes keep their meaning through a
// coloured mono tag (REMIX, DROP, BEAT, WARP, BURST); the mine is a red hazard chip with a
// blinking AVOID, the ghost a wireframe. Swipe directions on taps, slide heads and hold
// tails get blocky LED chevrons that step toward the swipe; hold heads stay plain, and hold
// ends get a blinking LED inside corner brackets.

import type { Note, NoteType } from '../../game/types';
import { SWIPE_ROT, SPECIAL } from './neonNotes';
import { drawSights, drawStrike } from './noteStrike';

const PLATE = '#15171d';
const PLATE_HI = '#3a3f4b';
const LED_OFF = 'rgba(255,255,255,0.08)';

export function drawRailKey(
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
  const h = Math.max(6, noteH * (isHold ? 0.55 : 0.64));

  ctx.save();
  try {
    if (noteType === 'mine') { drawHazard(ctx, w, h, t); return true; }
    if ((noteType as string) === 'ghost') { drawWire(ctx, w, h, laneColor, t); return true; }

    const isWarp = noteType === 'warp' || noteType === 'warp-clear';
    const special = noteType ? SPECIAL[noteType] : undefined;
    const color = isWarp ? `hsl(${(t * 240) % 360}, 100%, 60%)` : special?.color ?? laneColor;

    if (noteType === 'burst') drawBrackets(ctx, w, h, color, (t * 2.2) % 1);
    if (isWarp) drawSpinBrackets(ctx, w, h, t);

    const lift = noteType === 'lift' && (!swipeDirection || swipeDirection === 'up');
    const holdHead = !isHold && (noteType === 'hold' || noteType === 'hold-swipe');
    const hasArrow = (!!swipeDirection && !lift && !holdHead) || lift;

    drawChip(ctx, w, h, isHold, color, p);
    if (noteType === 'zigzag') {
      drawTrace(ctx, w, h, color, t);
      drawStrike(ctx, w - h * 0.9, h, color, p, { sights: false, glow: false, weight: Math.max(1, h * 0.05) });
    }
    else {
      // BEAT notes flash every segment on the beat; the rest charge with approach.
      const beatFlash = noteType === 'accent' && Math.sin(t * 9.4) > 0.3;
      ctx.save();
      if (hasArrow) ctx.globalAlpha = 0.3; // the arrow is the message; the bar steps back
      drawLeds(ctx, w, h, color, beatFlash ? 1 : 0.18 + 0.82 * p, noteType === 'remix' ? t : -1, p);
      ctx.restore();
    }
    drawSights(ctx, w, h, color, p);
    if (swipeDirection && !lift && !holdHead) drawPixelChevron(ctx, w, h, swipeDirection, color, t);
    else if (lift) drawPixelChevron(ctx, w, h, 'up', color, t);
    else if (isHold) drawHoldLed(ctx, h, color, t);

    const label = isWarp ? (noteType === 'warp' ? 'WARP' : 'WARP+') : special?.label;
    if (label && !isHold && !swipeDirection) drawTag(ctx, w, h, label, color);
  } finally {
    ctx.restore();
  }
  return true;
}

function chipPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const c = Math.min(h * 0.32, 8);
  const x = -w / 2, y = -h / 2;
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/**
 * Cut-corner gunmetal plate: dark body with a brushed grain, bevels top and bottom, and a
 * lane-colour edge light at each end that brightens as the note arrives.
 */
function drawChip(ctx: CanvasRenderingContext2D, w: number, h: number, isHold: boolean, color: string, p: number) {
  const c = Math.min(h * 0.32, 8);
  ctx.save();
  ctx.globalAlpha = isHold ? 0.85 : 1;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#2b303a');
  g.addColorStop(0.5, '#1b1e26');
  g.addColorStop(1, PLATE);
  ctx.fillStyle = g;
  chipPath(ctx, w, h);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Brushed grain: faint horizontal scratches, clipped to the plate.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 0.6;
  const rows = Math.max(3, Math.round(h / 5));
  for (let i = 1; i < rows; i++) {
    const y = -h / 2 + (i / rows) * h;
    ctx.beginPath();
    ctx.moveTo(-w / 2, y);
    ctx.lineTo(w / 2, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = PLATE_HI;
  ctx.lineWidth = 1;
  chipPath(ctx, w, h);
  ctx.stroke();
  // Bevels: a bright top edge and a dark bottom one.
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(-w / 2 + c, -h / 2 + 1);
  ctx.lineTo(w / 2 - c, -h / 2 + 1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.moveTo(-w / 2 + c, h / 2 - 1);
  ctx.lineTo(w / 2 - c, h / 2 - 1);
  ctx.stroke();

  // Edge lights: a lane-colour bar inside each end.
  const ew = Math.max(2, h * 0.09), eh = h * 0.5;
  ctx.globalAlpha *= 0.35 + 0.65 * p;
  ctx.fillStyle = color;
  for (const sx of [-1, 1]) ctx.fillRect(sx * (w / 2 - h * 0.26) - ew / 2, -eh / 2, ew, eh);
  ctx.restore();
}

/**
 * LED bar: N segments, each split into an upper and lower half by the centre groove; `lit`
 * (0..1) of them glow in the lane colour. sweepT ≥ 0 runs a scanner. The groove itself is
 * the strike line, lit white-hot over the lane colour and brightening with approach `p`.
 */
function drawLeds(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, lit: number, sweepT: number, p: number) {
  const n = w > 90 ? 8 : 6;
  const span = w - h * 0.9;
  const gap = Math.max(1.5, span * 0.025);
  const sw = (span - gap * (n - 1)) / n;
  const sh = Math.max(3, h * 0.46);
  const groove = Math.max(1.5, h * 0.08);
  const half = (sh - groove) / 2;
  const x0 = -span / 2;
  const litN = Math.round(lit * n);
  const scan = sweepT >= 0 ? Math.floor((sweepT * 10) % n) : -1;
  ctx.save();
  // One glow for the whole lit run. A shadow per segment costs sixteen blurred fills a note,
  // which is what made this skin stutter; a single blurred bar behind the run looks the same.
  if (litN > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillRect(x0, -sh / 2, litN * (sw + gap) - gap, sh);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PLATE;
    ctx.fillRect(x0, -sh / 2, litN * (sw + gap) - gap, sh);
  }
  for (let i = 0; i < n; i++) {
    const on = i < litN || i === scan;
    const x = x0 + i * (sw + gap);
    ctx.fillStyle = on ? color : LED_OFF;
    ctx.fillRect(x, -sh / 2, sw, half);
    ctx.fillRect(x, groove / 2, sw, half);
    if (on) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x, -sh / 2, sw, Math.max(1, half * 0.4));
    }
  }
  ctx.restore();
  drawStrike(ctx, span + gap * 2, h, color, p, { inset: 0, sights: false, glow: false, weight: groove * 0.7 });
}

/** Blocky LED chevrons built from squares, stepping (not gliding) toward the swipe. */
function drawPixelChevron(ctx: CanvasRenderingContext2D, w: number, h: number, dir: string, color: string, t: number) {
  const s = Math.max(9, Math.min(h * 1.15, w * 0.32));
  const px = Math.max(2.5, s * 0.2);
  const step = Math.floor(t * 8) % 4; // 4-frame step animation
  ctx.save();
  ctx.rotate(SWIPE_ROT[dir] ?? 0);
  for (let i = 0; i < 2; i++) {
    const phase = (step + i * 2) % 4;
    const y = s * 0.3 - phase * s * 0.22;
    ctx.globalAlpha = phase === 3 ? 0.35 : 1;
    for (let k = -2; k <= 2; k++) {
      const cx = k * px;
      const cy = y + Math.abs(k) * px * 0.9;
      ctx.fillStyle = '#05060a';
      ctx.fillRect(cx - px * 0.7, cy - px * 0.7, px * 1.4, px * 1.4);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillRect(cx - px / 2, cy - px / 2, px, px);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - px * 0.22, cy - px * 0.22, px * 0.44, px * 0.44);
    }
  }
  ctx.restore();
}

/** Hold end: a blinking LED inside corner brackets. */
function drawHoldLed(ctx: CanvasRenderingContext2D, h: number, color: string, t: number) {
  const s = Math.max(4, h * 0.3);
  const on = Math.floor(t * 4) % 2 === 0;
  ctx.save();
  ctx.fillStyle = on ? color : 'rgba(255,255,255,0.25)';
  if (on) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  const b = s * 1.1, l = s * 0.45;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(sx * b, sy * (b - l));
    ctx.lineTo(sx * b, sy * b);
    ctx.lineTo(sx * (b - l), sy * b);
    ctx.stroke();
  }
  ctx.restore();
}

/** Mono label on a solid tag in the note colour, centred on the chip. */
function drawTag(ctx: CanvasRenderingContext2D, w: number, h: number, label: string, color: string) {
  const size = Math.min(h * 0.46, (w * 0.6) / (label.length * 0.66));
  if (size < 7) return;
  ctx.save();
  ctx.font = `800 ${size}px "JetBrains Mono", ui-monospace, monospace`;
  const tw = ctx.measureText(label).width;
  const bw = tw + size * 0.8, bh = size * 1.3;
  ctx.fillStyle = color;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = '#0a0b0e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, size * 0.04);
  ctx.restore();
}

/** BURST: corner brackets that fly outward and reset. */
function drawBrackets(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, k: number) {
  const ex = w / 2 + 3 + k * h * 0.8, ey = h / 2 + 3 + k * h * 0.8, l = Math.max(4, h * 0.4);
  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.lineWidth = Math.max(2, h * 0.1);
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(sx * ex, sy * (ey - l));
    ctx.lineTo(sx * ex, sy * ey);
    ctx.lineTo(sx * (ex - l), sy * ey);
    ctx.stroke();
  }
  ctx.restore();
}

/** WARP: rainbow brackets orbiting the chip. */
function drawSpinBrackets(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.save();
  const r = Math.max(h * 1.1, w * 0.36);
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = t * 2.4 + (i * Math.PI) / 2;
    ctx.strokeStyle = `hsl(${(t * 240 + i * 90) % 360}, 100%, 62%)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.5, 0, a, a + 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

/** ZIGZAG: an LED trace instead of the bar, with a travelling bright pulse. */
function drawTrace(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, t: number) {
  const steps = 6, amp = h * 0.22;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) pts.push([-w * 0.38 + (i / steps) * w * 0.76, i % 2 ? -amp : amp]);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.lineWidth = Math.max(2, h * 0.12);
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  const k = (t * 1.5) % 1;
  const seg = Math.min(steps - 1, Math.floor(k * steps));
  const f = k * steps - seg;
  const [ax, ay] = pts[seg], [bx, by] = pts[seg + 1];
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ax + (bx - ax) * f, ay + (by - ay) * f, Math.max(2, h * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** MINE: red hazard chip with stripes and a blinking AVOID. */
function drawHazard(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const mw = w * 0.88, mh = h * 1.05;
  ctx.save();
  ctx.fillStyle = '#1c0508';
  chipPath(ctx, mw, mh);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,40,60,0.45)';
  ctx.lineWidth = Math.max(3, mh * 0.18);
  for (let x = -mw; x < mw; x += mh * 0.7) {
    ctx.beginPath();
    ctx.moveTo(x, mh / 2);
    ctx.lineTo(x + mh, -mh / 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#ff2a3c';
  ctx.lineWidth = 2;
  chipPath(ctx, mw, mh);
  ctx.stroke();
  const blink = Math.floor(t * 5) % 2 === 0;
  const size = Math.min(mh * 0.5, mw * 0.13);
  if (size >= 7) {
    ctx.font = `800 ${size}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = blink ? '#ffe2e5' : '#ff2a3c';
    ctx.fillText('⚠ AVOID', 0, size * 0.05);
  }
  ctx.restore();
}

/** GHOST: wireframe chip outline with a rolling scanline. */
function drawWire(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, t: number) {
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 8);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  chipPath(ctx, w, h);
  ctx.stroke();
  ctx.setLineDash([]);
  const y = -h / 2 + ((t * 1.4) % 1) * h;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(-w / 2, y);
  ctx.lineTo(w / 2, y);
  ctx.stroke();
  ctx.restore();
}
