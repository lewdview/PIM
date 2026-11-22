/**
 * Motion intros for the secret warp levels.
 *
 * A ~4 s canvas sequence that plays when a warp note drops the player into a
 * hidden level, then settles into a looping title card behind the START
 * button:
 *
 *   0.00  hyperspace tunnel   rainbow streaks rush out of the centre (the warp
 *                             note's colours), a riser builds
 *   1.05  flash + impact      white-out, boom, the level's world fades up
 *   1.20  header types in     "★ WARP ZONE ★" / "SECRET LEVEL FOUND", glitched
 *   1.70  title slam          letters drop in one by one with an RGB split and
 *                             a screen shake on each landing, then a shine
 *   2.00+ level diorama       SIGNAL SIEGE: the ship climbs in and lasers a
 *                             diving formation · ROOFTOP RUN: the runner
 *                             sprints across a neon skyline and clears spikes
 *   ~2.9  controls + START    (DOM, shown by the page once `introReady`)
 *
 * Everything is drawn from time alone, so any frame can be rendered at any
 * moment (and tested headless). With reduced motion the tunnel and slams are
 * skipped and the card fades straight to its resting frame.
 */

import type { SecretLevelId } from './warp';
import { RUNNER_FRAMES, type RunnerPose } from './runnerSprites';

export const INTRO_FLASH_AT = 1.05;
/** When the controls and START button should appear. */
export const INTRO_READY_AT = 2.9;
/** After START: the card collapses into the tunnel for this long… */
export const INTRO_OUTRO_S = 0.32;
/** …then the level is revealed through an opening iris for this long. */
export const INTRO_REVEAL_S = 0.5;

const HEADER_AT = 1.2;
const TITLE_AT = 1.7;
const LETTER_GAP = 0.075;
const LETTER_DROP = 0.22;

/** Draws a frame of a character sprite with its feet at (x, feet); false if the sheet isn't loaded yet. */
export type IntroSpriteFn = (
  ctx: CanvasRenderingContext2D, pose: RunnerPose, frame: number, x: number, feet: number, size: number,
) => boolean;

export interface IntroOptions {
  reduced?: boolean;
  outro?: number;
  /** Two header lines over the title; defaults to WARP ZONE / SECRET LEVEL FOUND. */
  header?: readonly [string, string];
  /** The runner's sprite sheet. Without it the runner is drawn as the mint capsule. */
  runnerSprite?: IntroSpriteFn;
  /** Course sky: [top, horizon, moon, skyline]. */
  sky?: readonly [string, string, string, string];
  previewPose?: RunnerPose;
}

export interface IntroLook {
  title: string;
  header: readonly [string, string];
  runnerSprite?: IntroSpriteFn;
  sky?: readonly [string, string, string, string];
  previewPose?: RunnerPose;
  accent: string;   // main glow colour for the level
  accent2: string;  // secondary colour
  bg: string;
}

export const INTRO_LOOKS: Record<SecretLevelId, Pick<IntroLook, 'accent' | 'accent2' | 'bg'>> = {
  shooter: { accent: '#00E5FF', accent2: '#B967FF', bg: '#05010F' },
  runner: { accent: '#FF4FD8', accent2: '#FFD23F', bg: '#12002B' },
};

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// ── easing ─────────────────────────────────────────────────────────────────
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInCubic = (t: number) => Math.pow(clamp01(t), 3);
const easeOutBack = (t: number) => {
  const c = 1.9;
  const x = clamp01(t) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};
/** Deterministic hash → 0..1, so glitches look random but every frame is reproducible. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const MONO = '"Space Mono", "JetBrains Mono", monospace';

// ── public entry ───────────────────────────────────────────────────────────

/**
 * Draw the intro at `t` seconds. `outro` (0..1) collapses the card into a
 * tunnel when START is pressed; pass 0 otherwise.
 */
export function drawWarpIntro(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  level: SecretLevelId,
  title: string,
  opts: IntroOptions = {},
) {
  const look: IntroLook = {
    ...INTRO_LOOKS[level],
    title,
    header: opts.header ?? ['★ WARP ZONE ★', 'SECRET LEVEL FOUND'],
    runnerSprite: opts.runnerSprite,
    sky: opts.sky,
    previewPose: opts.previewPose,
  };
  const reduced = !!opts.reduced;
  const outro = clamp01(opts.outro ?? 0);
  // Reduced motion: start at the resting frame, no tunnel, no slams
  const tt = reduced ? TITLE_AT + title.length * LETTER_GAP + 0.6 : t;
  let runnerFrame: { pose: RunnerPose; frame: number } | null = null;

  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  // Screen shake from the title slams and the flash
  const shake = reduced ? 0 : shakeAmount(tt, title.length) * Math.min(w, h) * 0.018;
  if (shake > 0.2) ctx.translate((hash(tt * 60) - 0.5) * shake * 2, (hash(tt * 60 + 9) - 0.5) * shake * 2);

  // World behind the title, fading up out of the flash
  if (tt >= INTRO_FLASH_AT - 0.05) {
    const worldIn = reduced ? clamp01(t / 0.5) : easeOutCubic((tt - INTRO_FLASH_AT) / 0.6);
    ctx.globalAlpha = worldIn;
    if (level === 'shooter') drawShooterDiorama(ctx, w, h, tt - INTRO_FLASH_AT, look);
    else runnerFrame = drawRunnerDiorama(ctx, w, h, tt - INTRO_FLASH_AT, { ...look, previewPose: opts.previewPose ?? (reduced ? 'idle' : undefined) });
    ctx.globalAlpha = 1;
  }

  if (!reduced && tt < INTRO_FLASH_AT + 0.25) drawTunnel(ctx, w, h, tt, 1 - clamp01((tt - INTRO_FLASH_AT) / 0.25));

  if (tt >= HEADER_AT) drawHeader(ctx, w, h, tt, look, reduced ? 1 : clamp01((t - 0) / 0.5));
  if (tt >= TITLE_AT) drawTitle(ctx, w, h, tt, look, reduced);

  drawCrt(ctx, w, h, tt);

  // Flash
  if (!reduced) {
    const f = tt < INTRO_FLASH_AT ? easeInCubic((tt - (INTRO_FLASH_AT - 0.18)) / 0.18) : 1 - easeOutCubic((tt - INTRO_FLASH_AT) / 0.5);
    if (f > 0.001) {
      ctx.fillStyle = `rgba(255,255,255,${clamp01(f)})`;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }
  }

  // Outro: the card is sucked back into a tunnel, then black for the count-in
  if (outro > 0) {
    drawTunnel(ctx, w, h, 0.4 + outro * 0.7, easeOutCubic(outro * 1.6) * (1 - easeInCubic(outro)));
    ctx.fillStyle = `rgba(0,0,0,${easeInCubic(outro)})`;
    ctx.fillRect(-20, -20, w + 40, h + 40);
  }

  ctx.restore();
  return runnerFrame;
}

function shakeAmount(t: number, letters: number): number {
  let s = 0;
  const sinceFlash = t - INTRO_FLASH_AT;
  if (sinceFlash >= 0) s += Math.max(0, 1 - sinceFlash / 0.35) * 1.4;
  for (let i = 0; i < letters; i++) {
    const land = TITLE_AT + i * LETTER_GAP + LETTER_DROP;
    const d = t - land;
    if (d >= 0 && d < 0.18) s += (1 - d / 0.18) * 0.55;
  }
  return Math.min(s, 2);
}

// ── hyperspace tunnel ─────────────────────────────────────────────────────

function drawTunnel(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, alpha: number) {
  if (alpha <= 0.001) return;
  const cx = w / 2;
  const cy = h * 0.46;
  const R = Math.hypot(w, h) * 0.6;
  const speed = easeInCubic(clamp01(t / INTRO_FLASH_AT)) * 0.9 + 0.1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const N = 150;
  for (let i = 0; i < N; i++) {
    const a = hash(i) * Math.PI * 2;
    // each streak loops outward; faster as the warp builds
    const phase = (hash(i + 0.5) + t * (0.6 + 2.6 * speed) * (0.6 + hash(i + 2) * 0.8)) % 1;
    const r0 = Math.pow(phase, 2.2) * R;
    const len = (0.02 + speed * 0.38) * R * (0.4 + phase);
    const r1 = Math.min(R * 1.2, r0 + len);
    const hue = (hash(i + 7) * 360 + t * 260) % 360;
    ctx.strokeStyle = `hsla(${hue},100%,${62 + 20 * phase}%,${0.15 + 0.85 * phase})`;
    ctx.lineWidth = 0.6 + phase * (1.5 + 3 * speed);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  // Pulsing rings rushing past
  for (let k = 0; k < 5; k++) {
    const p = ((t * (1 + 2 * speed) + k / 5) % 1);
    const r = Math.pow(p, 2.4) * R;
    ctx.strokeStyle = `hsla(${(t * 300 + k * 72) % 360},100%,65%,${0.35 * (1 - p) * p * 4})`;
    ctx.lineWidth = 2 + p * 10;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.82, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Core bloom
  const core = 18 + speed * Math.min(w, h) * 0.22;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, core);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, `hsla(${(t * 400) % 360},100%,70%,0.55)`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - core, cy - core, core * 2, core * 2);
  ctx.restore();
}

// ── header + title ────────────────────────────────────────────────────────

const GLYPHS = '!<>-_\\/[]{}=+*^?#█▓▒░';

function scramble(text: string, t: number, revealPerChar: number, seed: number): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const at = i * revealPerChar;
    if (t >= at + 0.12 || c === ' ') out += c;
    else if (t >= at) out += GLYPHS[Math.floor(hash(seed + i + Math.floor(t * 30)) * GLYPHS.length)];
    else out += ' ';
  }
  return out;
}

function drawHeader(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, look: IntroLook, fade: number) {
  const local = t - HEADER_AT;
  const size = Math.max(10, Math.min(15, w * 0.03));
  const y = h * (w < 640 ? 0.13 : 0.22);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${MONO}`;
  const top = scramble(look.header[0], local, 0.03, 11);
  // letter-spaced
  drawSpaced(ctx, top, w / 2, y, size * 0.45, '#F5D0FE', look.accent2);
  ctx.font = `700 ${size * 0.82}px ${MONO}`;
  const sub = scramble(look.header[1], local - 0.22, 0.022, 41);
  drawSpaced(ctx, sub, w / 2, y + size * 1.9, size * 0.35, 'rgba(255,255,255,0.72)', look.accent);
  // Scan bars either side
  const barW = easeOutCubic(local / 0.5) * Math.min(w * 0.18, 140);
  ctx.fillStyle = look.accent2;
  ctx.shadowColor = look.accent2;
  ctx.shadowBlur = 10;
  ctx.font = `700 ${size}px ${MONO}`;
  const tw = ctx.measureText(look.header[0]).width / 2 + look.header[0].length * size * 0.22 + 12;
  ctx.fillRect(w / 2 - tw - barW, y - 1, barW, 2);
  ctx.fillRect(w / 2 + tw, y - 1, barW, 2);
  ctx.restore();
}

function drawSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number, fill: string, glow: string) {
  const widths = [...text].map((c) => ctx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let x = cx - total / 2;
  ctx.fillStyle = fill;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 12;
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x, y);
    x += widths[i];
  }
  ctx.textAlign = 'center';
}

function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, look: IntroLook, reduced: boolean) {
  const text = look.title;
  const local = t - TITLE_AT;
  // Fit the title to the width
  let size = Math.min(h * 0.12, 96);
  ctx.font = `900 ${size}px ${MONO}`;
  const fit = (w * 0.9) / Math.max(1, ctx.measureText(text).width);
  if (fit < 1) size *= fit;
  ctx.font = `900 ${size}px ${MONO}`;
  const cy = h * (w < 640 ? 0.25 : 0.35);
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = w / 2 - total / 2;
  const settled = TITLE_AT + text.length * LETTER_GAP + LETTER_DROP;

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  // Idle glitch: every so often a slice of the title jumps sideways
  const glitchSeed = Math.floor(t * 7);
  const glitching = !reduced && t > settled + 0.5 && hash(glitchSeed) > 0.82;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const start = i * LETTER_GAP;
    const p = reduced ? 1 : clamp01((local - start) / LETTER_DROP);
    if (p <= 0) {
      x += widths[i];
      continue;
    }
    const e = easeOutBack(p);
    const scale = 1 + (1 - e) * 2.2;
    const alpha = clamp01(p * 2.5);
    // RGB split, big on impact, small afterwards, breathing on the beat
    const since = local - start - LETTER_DROP;
    const split = (since < 0 ? 10 : Math.max(0, 1 - since / 0.4) * 8) + 1.2 + (glitching ? 6 : 0);
    const cx = x + widths[i] / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,40,90,0.85)';
    ctx.fillText(c, -widths[i] / 2 - split, 0);
    ctx.fillStyle = 'rgba(0,229,255,0.85)';
    ctx.fillText(c, -widths[i] / 2 + split, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = look.accent2;
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(c, -widths[i] / 2, 0);
    ctx.restore();
    // Impact ring under each letter as it lands
    if (!reduced && since >= 0 && since < 0.35) {
      const rp = since / 0.35;
      ctx.save();
      ctx.strokeStyle = look.accent;
      ctx.globalAlpha = 1 - rp;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + size * 0.42, widths[i] * (0.4 + rp * 1.2), size * 0.08 * (1 + rp), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    x += widths[i];
  }

  // Glitch slice: copy a band of the title sideways
  if (glitching) {
    const band = size * (0.12 + hash(glitchSeed + 3) * 0.25);
    const by = cy - size / 2 + hash(glitchSeed + 5) * size;
    const dx = (hash(glitchSeed + 8) - 0.5) * size * 0.6;
    try {
      const dpr = ctx.getTransform().a || 1;
      const img = ctx.getImageData(0, Math.max(0, by * dpr), Math.ceil(w * dpr), Math.ceil(band * dpr));
      ctx.putImageData(img, dx * dpr, by * dpr);
    } catch {
      /* tainted or unsupported: skip the slice */
    }
  }

  // Shine sweep once the title has landed, then every few seconds
  const sweepT = (t - settled) % 3.2;
  if (t > settled && sweepT < 0.7) {
    // Re-draw the title in a moving highlight gradient so only the letters catch the light
    const sx = w / 2 - total / 2 - size + (total + size * 2) * easeOutCubic(sweepT / 0.7);
    ctx.save();
    const g = ctx.createLinearGradient(sx - size * 0.8, 0, sx + size * 0.8, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, look.accent);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.globalCompositeOperation = 'lighter';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, cy);
    ctx.restore();
  }

  // Underline that draws itself out from the middle
  const ul = easeOutCubic((t - settled + 0.1) / 0.5);
  if (ul > 0) {
    const half = (total / 2) * ul;
    const g = ctx.createLinearGradient(w / 2 - half, 0, w / 2 + half, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, look.accent);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.shadowColor = look.accent;
    ctx.shadowBlur = 14;
    ctx.fillRect(w / 2 - half, cy + size * 0.62, half * 2, 3);
  }
  ctx.restore();
}

// ── CRT overlay ───────────────────────────────────────────────────────────

function drawCrt(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  // Rolling bar
  const by = ((t * 0.25) % 1) * (h + 120) - 60;
  const g = ctx.createLinearGradient(0, by - 60, 0, by + 60);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.035)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, by - 60, w, 120);
  // Vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ── SIGNAL SIEGE diorama ──────────────────────────────────────────────────

function drawShooterDiorama(ctx: CanvasRenderingContext2D, w: number, h: number, s: number, look: IntroLook) {
  ctx.fillStyle = look.bg;
  ctx.fillRect(0, 0, w, h);
  // Starfield streaking down, slowing from warp speed to cruise
  const warp = Math.max(0, 1 - s / 1.2);
  for (let i = 0; i < 90; i++) {
    const size = 0.6 + hash(i + 3) * 1.4;
    const y = ((hash(i + 1) + s * (0.08 + warp * 1.6) * size) % 1) * h;
    const x = hash(i) * w;
    ctx.fillStyle = `rgba(200,220,255,${0.25 + 0.5 * hash(i + 5)})`;
    ctx.fillRect(x, y, size, size * (1 + warp * 40 + 2));
  }
  // Perspective grid floor glowing from below
  const horizon = h * 0.62;
  ctx.save();
  ctx.strokeStyle = 'rgba(185,103,255,0.22)';
  ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * w * 0.03, horizon);
    ctx.lineTo(w / 2 + i * w * 0.2, h);
    ctx.stroke();
  }
  for (let k = 0; k < 8; k++) {
    const p = ((k / 8 + s * 0.35) % 1);
    const y = horizon + Math.pow(p, 2) * (h - horizon);
    ctx.globalAlpha = p;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  const formIn = easeOutCubic((s - 0.5) / 1.1);
  const lane = (l: number) => w * (0.22 + 0.28 * l);
  const beat = s * (140 / 60);
  // Formation sits above the header, out of the way of the title
  const slotPos = (dx: number, dy: number) => ({
    x: w / 2 + dx * Math.min(w * 0.16, 80),
    y: h * (-0.15 + formIn * (0.26 + dy * 0.035)),
  });

  // Formation: a V of drones swoops down from the top and hovers, bobbing on the beat
  const slots = [[-2, 0], [-1, 0.5], [0, 1], [1, 0.5], [2, 0]];
  const shots = shooterShots(s);
  slots.forEach(([dx, dy], i) => {
    const killedAt = shots.find((k) => k.target === i)?.hit ?? Infinity;
    const respawn = killedAt + 1.4;
    const alive = s < killedAt || s > respawn;
    const sp = slotPos(dx, dy);
    const ex = sp.x + Math.sin(s * 1.3 + i) * 6;
    const ey = sp.y + Math.sin(beat * Math.PI) * 4;
    if (alive) {
      const back = s > respawn ? easeOutBack((s - respawn) / 0.4) : 1;
      drawDrone(ctx, ex, ey, Math.min(w, h) * 0.028 * back, beat, i === 2 ? '#FF3B6B' : look.accent2);
    } else if (s - killedAt < 0.6) {
      drawBurst(ctx, ex, ey, s - killedAt, i);
    }
  });

  // Ship climbs up from below the screen, then strafes lanes
  const rise = easeOutBack((s - 0.85) / 0.8);
  const shipLane = shooterLaneAt(s);
  const shipX = lane(0) + (lane(1) - lane(0)) * shipLane;
  const shipY = h * (1.15 - 0.27 * rise);
  drawShip(ctx, shipX, shipY, 1 - (((beat % 1) + 1) % 1), Math.min(w, h) / 600);

  // Lasers from ship to target
  for (const k of shots) {
    if (s < k.fire || s > k.hit + 0.18) continue;
    const slot = slots[k.target];
    const { x: tx, y: ty } = slotPos(slot[0], slot[1]);
    const p = clamp01((s - k.fire) / (k.hit - k.fire));
    const sx = lane(0) + (lane(1) - lane(0)) * shooterLaneAt(k.fire);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `hsl(${(s * 400) % 360},100%,70%)`;
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx, shipY - 24);
    ctx.lineTo(sx + (tx - sx) * p, shipY - 24 + (ty - shipY + 24) * p);
    ctx.stroke();
    ctx.restore();
  }
}

/** Scripted shots, looping every 4 s after the ship arrives. */
function shooterShots(s: number) {
  const out: { fire: number; hit: number; target: number }[] = [];
  const base = 2.0;
  const loop = 4;
  const cycle = Math.max(0, Math.floor((s - base) / loop));
  for (let c = Math.max(0, cycle - 1); c <= cycle; c++) {
    const o = base + c * loop;
    out.push({ fire: o, hit: o + 0.12, target: 2 }, { fire: o + 0.9, hit: o + 1.02, target: 0 }, { fire: o + 1.8, hit: o + 1.92, target: 4 });
  }
  // keep only the latest shot per target
  const latest = new Map<number, { fire: number; hit: number; target: number }>();
  for (const k of out) if (k.fire <= s + 0.2) latest.set(k.target, k);
  return [...latest.values()];
}

function shooterLaneAt(s: number) {
  // lane pattern 1 → 0 → 2 → 1, eased
  const keys = [[0, 1], [2.5, 1], [2.75, 0], [3.4, 0], [3.65, 2], [4.3, 2], [4.55, 1], [6, 1]];
  const loopT = s < 2 ? s : 2 + ((s - 2) % 4);
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, l0] = keys[i];
    const [t1, l1] = keys[i + 1];
    if (loopT >= t0 && loopT <= t1) return l0 + (l1 - l0) * easeOutCubic((loopT - t0) / Math.max(0.001, t1 - t0));
  }
  return 1;
}

function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number, k: number) {
  const sc = Math.max(0.8, Math.min(1.6, k * 1.4));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.fillStyle = `rgba(255,140,0,${0.5 + 0.5 * pulse})`;
  ctx.beginPath();
  ctx.moveTo(-6, 16);
  ctx.lineTo(0, 34 + 12 * pulse);
  ctx.lineTo(6, 16);
  ctx.fill();
  ctx.fillStyle = '#00E5FF';
  ctx.shadowColor = '#00E5FF';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(18, 16);
  ctx.lineTo(0, 8);
  ctx.lineTo(-18, 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-2, -10, 4, 10);
  ctx.restore();
}

function drawDrone(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, beat: number, color: string) {
  const flap = Math.sin(beat * Math.PI * 2) * 0.35;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(0, r);
  ctx.lineTo(r * 1.3, -r * (0.4 + flap));
  ctx.lineTo(r * 0.5, -r * 0.2);
  ctx.lineTo(0, -r * 0.8);
  ctx.lineTo(-r * 0.5, -r * 0.2);
  ctx.lineTo(-r * 1.3, -r * (0.4 + flap));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-r * 0.15, -r * 0.1, r * 0.3, r * 0.3);
  ctx.restore();
}

function drawBurst(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, seed: number) {
  const p = clamp01(age / 0.6);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = hash(seed * 31 + i) * Math.PI * 2;
    const d = easeOutCubic(p) * (20 + hash(seed + i * 3) * 30);
    ctx.fillStyle = i % 3 === 0 ? '#FFE36E' : i % 3 === 1 ? '#FF3B6B' : '#FFFFFF';
    ctx.globalAlpha = 1 - p;
    ctx.fillRect(x + Math.cos(a) * d - 2, y + Math.sin(a) * d - 2, 4, 4);
  }
  ctx.strokeStyle = '#FFFFFF';
  ctx.globalAlpha = 1 - p;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 6 + p * 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ── ROOFTOP RUN diorama ───────────────────────────────────────────────────

const RUNNER_BPM = 128;
const RUNNER_LOOP = 4; // beats: a gap to jump on beat 0, a patrol drone to slash on beat 2
const SWING_BEATS = 0.88; // as in runner.ts
const actionFrame = (elapsed: number, duration: number) => Math.min(RUNNER_FRAMES - 1, Math.max(0, Math.floor((elapsed / duration) * RUNNER_FRAMES)));

function drawRunnerDiorama(ctx: CanvasRenderingContext2D, w: number, h: number, s: number, look: IntroLook) {
  const [skyTop, horizon, moon, skyline] = look.sky ?? ['#12002B', '#3B0A4F', '#FFD23F', '#0A0014'];
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, skyTop);
  sky.addColorStop(0.72, horizon);
  sky.addColorStop(1, look.accent);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Moon with slats, rising behind the city
  const sunR = Math.min(w, h) * 0.2;
  const sunY = h * 0.66 - easeOutCubic(s / 1.5) * h * 0.06;
  ctx.save();
  const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sg.addColorStop(0, moon);
  sg.addColorStop(1, look.accent);
  ctx.fillStyle = sg;
  ctx.shadowColor = look.accent;
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(w / 2, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = horizon;
  for (let i = 0; i < 6; i++) ctx.fillRect(w / 2 - sunR, sunY + sunR * (0.1 + i * 0.16), sunR * 2, 2 + i * 1.4);
  ctx.restore();

  // Parallax skyline: three layers, scrolling faster as the camera dollies in
  const roof = h * (w < 640 ? 0.47 : 0.78);
  const speed = 0.4 + easeOutCubic(s) * 0.6;
  const layers = [
    { k: 0.15, col: horizon, a: 0.8, hMin: 0.18, hMax: 0.36, win: 'rgba(255,79,216,0.25)' },
    { k: 0.35, col: skyline, a: 0.9, hMin: 0.12, hMax: 0.3, win: 'rgba(0,229,255,0.35)' },
    { k: 0.7, col: '#0A0014', a: 1, hMin: 0.06, hMax: 0.2, win: 'rgba(255,210,63,0.5)' },
  ];
  layers.forEach((L, li) => {
    const scroll = s * speed * L.k * w;
    const bw = w * (0.08 + li * 0.03);
    const first = Math.floor(scroll / bw) - 1;
    for (let b = first; b < first + Math.ceil(w / bw) + 3; b++) {
      const bh = h * (L.hMin + hash(b * 7 + li * 100) * (L.hMax - L.hMin));
      const x = b * bw - scroll;
      const top = roof - bh + li * h * 0.02;
      ctx.globalAlpha = L.a;
      ctx.fillStyle = L.col;
      ctx.fillRect(x, top, bw - 3, roof - top + h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = L.win;
      for (let wy = top + 8; wy < roof - 6; wy += 10) {
        for (let wx = x + 5; wx < x + bw - 8; wx += 8) {
          if (hash(b * 13 + wx * 0.7 + wy * 1.3 + li) > 0.62) ctx.fillRect(wx, wy, 3, 4);
        }
      }
      if (li === 1 && hash(b) > 0.7) {
        ctx.fillStyle = Math.floor(s * 2 + b) % 2 ? '#FF3B6B' : 'rgba(255,59,107,0.2)';
        ctx.fillRect(x + bw / 2, top - 12, 2, 12);
      }
    }
  });

  // The rooftop
  ctx.fillStyle = '#05010F';
  ctx.fillRect(0, roof, w, h - roof);
  ctx.save();
  ctx.strokeStyle = '#7CFFCB';
  ctx.shadowColor = '#7CFFCB';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, roof);
  ctx.lineTo(w, roof);
  ctx.stroke();
  ctx.restore();

  // Course loop: she jumps a spike on the beat, then cuts down a patrol drone
  const beat = s * (RUNNER_BPM / 60) - 2; // the first loop starts once she's on screen
  const runnerX = w * (w < 640 ? 0.3 : 0.22) + (1 - easeOutCubic((s - 0.6) / 0.9)) * -w * 0.45;
  const step = Math.max(72, w * 0.2); // pixels per beat, as in the level
  const unit = Math.min(w, h) * 0.03;
  const spriteSize = Math.min(h * 0.155, w * 0.43);
  const loop0 = Math.floor(beat / RUNNER_LOOP);
  for (let n = loop0 - 1; n < loop0 + 4; n++) {
    if (n < 0) continue;
    // spike half a beat into the jump
    const sx = runnerX + (n * RUNNER_LOOP + 0.5 - beat) * step;
    if (sx > -40 && sx < w + 40) {
      ctx.save();
      ctx.fillStyle = '#FF3B6B';
      ctx.shadowColor = '#FF3B6B';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(sx - unit, roof);
      ctx.lineTo(sx, roof - unit * 1.6);
      ctx.lineTo(sx + unit, roof);
      ctx.fill();
      ctx.restore();
      // coin over the spike, collected in the air
      if (beat < n * RUNNER_LOOP + 0.5) drawCoin(ctx, sx, roof - h * 0.17, unit, s + n);
    }
    // drone arrives at chest height and is slashed as it reaches her
    const hitBeat = n * RUNNER_LOOP + 2.4;
    const dx = runnerX + spriteSize * 0.22 + (hitBeat - beat) * step;
    const dy = roof - spriteSize * 0.55 + Math.sin(s * 6 + n) * 4;
    if (beat < hitBeat) {
      if (dx < w + 40) drawDrone(ctx, dx, dy, unit * 0.9, beat, '#FF3B6B');
    } else if (beat - hitBeat < 0.9) {
      drawBurst(ctx, dx, dy, (beat - hitBeat) * (60 / RUNNER_BPM), n);
      drawSlashArc(ctx, runnerX + spriteSize * 0.12, roof - spriteSize * 0.55, spriteSize * 0.5, (beat - hitBeat) / 0.4);
    }
  }

  // Pose for this beat, timed like RunnerLevel.animation()
  const local = beat - loop0 * RUNNER_LOOP;
  let pose: RunnerPose = 'run';
  let frame = Math.floor((((beat % 1) + 1) % 1) * RUNNER_FRAMES);
  let air = 0;
  if (beat >= 0 && local < 1) {
    pose = 'jump';
    frame = Math.max(2, actionFrame(local, 1));
    air = 4 * local * (1 - local);
  } else if (beat >= 0 && local >= 2.4 - SWING_BEATS * 0.45 && local < 2.4 - SWING_BEATS * 0.45 + SWING_BEATS) {
    pose = 'attack';
    frame = actionFrame(local - (2.4 - SWING_BEATS * 0.45), SWING_BEATS);
  }
  if (look.previewPose) {
    pose = look.previewPose;
    frame = Math.floor(s * 12.5) % RUNNER_FRAMES;
    air = 0;
  }
  const feet = roof - air * h * 0.2; // JUMP_H in runner.ts
  // Backlight so her dark silhouette reads against the skyline
  ctx.save();
  const cy = feet - spriteSize * 0.45;
  const glow = ctx.createRadialGradient(runnerX, cy, 0, runnerX, cy, spriteSize * 0.7);
  glow.addColorStop(0, 'rgba(255,141,233,0.45)');
  glow.addColorStop(0.5, 'rgba(255,141,233,0.16)');
  glow.addColorStop(1, 'rgba(255,141,233,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(runnerX - spriteSize, cy - spriteSize, spriteSize * 2, spriteSize * 2);
  ctx.restore();
  ctx.save();
  ctx.shadowColor = '#ff8de9';
  ctx.shadowBlur = 16;
  const drawn = look.runnerSprite?.(ctx, pose, frame, runnerX, feet, spriteSize) ?? false;
  ctx.restore();
  if (!drawn) drawRunner(ctx, runnerX, feet - 8, h, beat, air > 0.05);

  // Speed lines at the start, while the camera catches up
  const lines = Math.max(0, 1 - s / 1.2);
  if (lines > 0) {
    ctx.save();
    ctx.globalAlpha = lines;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 20; i++) {
      const y = hash(i) * h;
      const x = ((((hash(i + 3) - s * 3) % 1) + 1) % 1) * w;
      ctx.lineWidth = 1 + hash(i + 5) * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * 0.2, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  return { pose, frame };
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, t: number) {
  ctx.save();
  ctx.fillStyle = '#FFD23F';
  ctx.shadowColor = '#FFD23F';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(x, y, unit * 0.45 * Math.abs(Math.cos(t * 4)) + 1, unit * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSlashArc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, p: number) {
  if (p >= 1) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,141,233,${1 - p})`;
  ctx.shadowColor = '#FF8DE9';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 6 * (1 - p) + 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r * (1 + p * 0.2), -Math.PI * 0.55, -Math.PI * 0.55 + Math.PI * 1.1 * easeOutCubic(Math.min(1, p * 2.5)));
  ctx.stroke();
  ctx.restore();
}

/** Fallback when the sprite sheet isn't available: the mint capsule runner. */
function drawRunner(ctx: CanvasRenderingContext2D, x: number, footY: number, h: number, beat: number, airborne: boolean) {
  const bodyH = 0.075 * h; // PLAYER_H in runner.ts
  const bodyW = 24;
  ctx.save();
  ctx.fillStyle = '#7CFFCB';
  ctx.shadowColor = '#7CFFCB';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.roundRect(x - bodyW / 2, footY - bodyH, bodyW, bodyH, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#05010F';
  ctx.fillRect(x + 2, footY - bodyH + 8, 5, 5);
  if (!airborne) {
    const step = Math.sin(beat * Math.PI * 4) * 6;
    ctx.strokeStyle = '#7CFFCB';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 5, footY);
    ctx.lineTo(x - 5 + step, footY + 8);
    ctx.moveTo(x + 5, footY);
    ctx.lineTo(x + 5 - step, footY + 8);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Iris reveal over the level after the outro: black outside a growing circle
 * whose edge is a rainbow warp ring. `p` runs 0 → 1.
 */
export function drawWarpReveal(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) {
  if (p >= 1) return;
  const cx = w / 2;
  const cy = h * 0.46;
  const R = Math.hypot(w, h) * 0.62;
  const r = easeOutCubic(p) * R;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.rect(-20, -20, w + 40, h + 40);
  ctx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = `hsla(${(t * 400 + k * 120) % 360},100%,65%,${(1 - p) * 0.9})`;
    ctx.lineWidth = 10 - k * 3;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.1, r - k * 6), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ── stinger audio ─────────────────────────────────────────────────────────

/**
 * Riser → impact → sparkle, timed to the intro. Plays only if the browser
 * already allows audio (the player just tapped the warp note, so it usually
 * does). Returns a stop function.
 */
export function playWarpStinger(level: SecretLevelId, reduced = false): () => void {
  if (typeof window === 'undefined') return () => {};
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};
  let ctx: AudioContext;
  try {
    ctx = new Ctx();
  } catch {
    return () => {};
  }
  let closed = false;
  const stop = () => {
    if (closed) return;
    closed = true;
    ctx.close().catch(() => undefined);
  };
  void ctx.resume().catch(() => undefined).then(() => {
    if (closed || ctx.state !== 'running') return;
    let vol = 0.8;
    try {
      vol = parseFloat(localStorage.getItem('opt_sfxVolume') ?? '0.8');
      if (!Number.isFinite(vol)) vol = 0.8;
    } catch { /* default */ }
    const master = ctx.createGain();
    master.gain.value = 0.22 * vol;
    master.connect(ctx.destination);
    const now = ctx.currentTime + 0.03;
    const root = level === 'runner' ? 50 : 45;
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const flash = reduced ? 0 : INTRO_FLASH_AT;

    // Noise buffer
    const len = Math.floor(ctx.sampleRate * 1.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    if (!reduced) {
      // Riser: filtered noise sweeping up + a pitch-climbing saw
      const n = ctx.createBufferSource();
      n.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 4;
      bp.frequency.setValueAtTime(300, now);
      bp.frequency.exponentialRampToValueAtTime(7000, now + flash);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(0.7, now + flash);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + flash + 0.05);
      n.connect(bp).connect(ng).connect(master);
      n.start(now);
      n.stop(now + flash + 0.1);

      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(hz(root - 12), now);
      o.frequency.exponentialRampToValueAtTime(hz(root + 24), now + flash);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(400, now);
      lp.frequency.exponentialRampToValueAtTime(5000, now + flash);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(0.25, now + flash);
      og.gain.exponentialRampToValueAtTime(0.0001, now + flash + 0.04);
      o.connect(lp).connect(og).connect(master);
      o.start(now);
      o.stop(now + flash + 0.1);
    }

    // Impact: sub drop + noise crack
    const at = now + flash;
    const k = ctx.createOscillator();
    k.frequency.setValueAtTime(160, at);
    k.frequency.exponentialRampToValueAtTime(32, at + 0.5);
    const kg = ctx.createGain();
    kg.gain.setValueAtTime(1, at);
    kg.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
    k.connect(kg).connect(master);
    k.start(at);
    k.stop(at + 0.75);
    const c = ctx.createBufferSource();
    c.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.6, at);
    cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    c.connect(hp).connect(cg).connect(master);
    c.start(at);
    c.stop(at + 0.5);

    // Power chord swell under the title
    [0, 7, 12].forEach((iv) => {
      const p = ctx.createOscillator();
      p.type = 'square';
      p.frequency.value = hz(root + iv);
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.0001, at);
      pg.gain.exponentialRampToValueAtTime(0.07, at + 0.05);
      pg.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
      p.connect(pg).connect(master);
      p.start(at);
      p.stop(at + 1.7);
    });

    // Letter-slam ticks + a sparkle arpeggio as the title settles
    const titleStart = now + (reduced ? 0.1 : TITLE_AT);
    const letters = 12;
    for (let i = 0; i < letters && !reduced; i++) {
      const when = titleStart + i * LETTER_GAP + LETTER_DROP;
      const tk = ctx.createOscillator();
      tk.type = 'square';
      tk.frequency.setValueAtTime(hz(root + 24 + (i % 4) * 3), when);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.06, when);
      tg.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
      tk.connect(tg).connect(master);
      tk.start(when);
      tk.stop(when + 0.06);
    }
    const arp = [0, 4, 7, 12, 16, 19, 24];
    arp.forEach((iv, i) => {
      const when = titleStart + letters * LETTER_GAP + 0.3 + i * 0.055;
      const a = ctx.createOscillator();
      a.type = 'triangle';
      a.frequency.value = hz(root + 24 + iv);
      const ag = ctx.createGain();
      ag.gain.setValueAtTime(0.12, when);
      ag.gain.exponentialRampToValueAtTime(0.0001, when + 0.35);
      a.connect(ag).connect(master);
      a.start(when);
      a.stop(when + 0.4);
    });

    // Let it ring out, then free the context
    setTimeout(stop, 5000);
  });
  return stop;
}
