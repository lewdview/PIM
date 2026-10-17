// PIM : per-POV signature scenes
//
// Each POV camera gets its own backdrop, palette and hit reaction so switching
// cameras changes the whole look, not just the note path. Lane guides are traced
// from getArchetypeProjection itself, so they always sit exactly under the notes.
// Rendering only: nothing here touches timing, input or judging.

import type { PovMode } from '@/lib/options';
import type { TrackArchetype } from './archetypes';
import { getArchetypeProjection, canyonBend } from './projections';
import { getStageGeometry, laneAt, lerp } from './geometry';
import { LANE_COUNT } from './constants';
import { colorWithAlpha } from './colorUtils';

export interface PovSceneInput {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  t: number;
  /** Seconds a note takes to travel from spawn to the hit line. */
  approachSec: number;
  bpm: number;
  /** 0..1 beat pulse, peaks on each beat. */
  beat: number;
  stage: number;
  archetype: TrackArchetype;
  laneColors: string[];
  /** Wall-clock ms of the latest judged hit per lane (Date.now() based). */
  laneHitMs: (number | undefined)[];
  laneHitType: (string | undefined)[];
  nowMs: number;
  pressed: boolean[];
  /** 0..1 intensity from the current combo. */
  energy: number;
  lite: boolean;
}

const SCENE_POVS: ReadonlySet<PovMode> = new Set<PovMode>([
  'flat_2d',
  'canyon_run',
  'aurora_bridge',
  'horizontal_drift',
  'cockpit_hud',
  'hyper_prism',
  'dna_helix',
  'vertigo_drop',
  'singularity_void',
  'ground_zero',
  'orbital_halo',
  'mobius_loop',
]);

/** POVs that draw a signature scene from this module instead of the song archetype's environment. */
export function hasPovScene(pov: PovMode): boolean {
  return SCENE_POVS.has(pov);
}

/** POVs whose notes still travel down the classic straight highway columns. */
export function usesFlatHighway(pov: PovMode): boolean {
  return pov === 'flat_2d';
}

/** False for POVs whose strike targets stack, so a horizontal baseline would mislead. */
export function hasStraightHitLine(pov: PovMode): boolean {
  return pov !== 'horizontal_drift';
}

const HIT_FLASH_MS = 320;

function hitFlash(s: PovSceneInput, lane: number): number {
  const ts = s.laneHitMs[lane];
  if (!ts || s.laneHitType[lane] === 'MISS') return 0;
  const age = s.nowMs - ts;
  if (age < 0 || age > HIT_FLASH_MS) return 0;
  return 1 - age / HIT_FLASH_MS;
}

function anyHitFlash(s: PovSceneInput): number {
  let m = 0;
  for (let i = 0; i < LANE_COUNT; i++) m = Math.max(m, hitFlash(s, i));
  return m;
}

// Deterministic pseudo-random so scene layouts don't flicker frame to frame.
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function proj(s: PovSceneInput, pov: PovMode, lane: number, p: number) {
  const r = getArchetypeProjection(lane, p, s.W, s.H, s.archetype, s.stage, s.t, pov);
  return { cx: r.x + r.w / 2, cy: r.y, w: r.w, h: r.h };
}

interface LaneGuideOpts {
  fill: number;
  edge: number;
  startP?: number;
  /** Beat ticks that scroll down each lane at note speed. Default on. */
  ticks?: boolean;
  /** Dark glass under the tint so the ribbon reads as a surface over busy backdrops. */
  base?: number;
}

/**
 * Lane ribbons traced along the real note path: a dark glass base, a colour tint
 * that deepens toward the player, a bright core filament, beat ticks that ride
 * the lane at note speed, and a receptor pool at the target. Everything
 * brightens when the lane is pressed or just scored a hit.
 */
function drawLaneGuides(s: PovSceneInput, pov: PovMode, opts: LaneGuideOpts) {
  const { ctx } = s;
  const steps = s.lite ? 14 : 28;
  const p0 = opts.startP ?? 0.02;
  const base = opts.base ?? 0.32;
  const beatSec = 60 / Math.max(40, s.bpm || 120);

  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const col = s.laneColors[lane] || '#00E5FF';
    const flash = hitFlash(s, lane);
    const press = s.pressed[lane] ? 1 : 0;
    const boost = Math.max(flash * 0.9, press * 0.35);

    const pts: { x: number; y: number; w: number; h: number; half: number; nx: number; ny: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = proj(s, pov, lane, lerp(p0, 1, i / steps));
      pts.push({ x: a.cx, y: a.cy, w: a.w, h: a.h, half: 0, nx: 0, ny: 0 });
    }
    // Cross-size follows the travel direction: note width when moving vertically, note height when moving sideways.
    for (let i = 0; i <= steps; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(steps, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      pts[i].half = (Math.abs(dy) >= Math.abs(dx) ? pts[i].w : pts[i].h * 0.9) * 0.46;
      const len = Math.hypot(dx, dy) || 1;
      pts[i].nx = -dy / len;
      pts[i].ny = dx / len;
    }

    const trace = (k: number) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x + pts[0].nx * pts[0].half * k, pts[0].y + pts[0].ny * pts[0].half * k);
      for (let i = 1; i <= steps; i++) ctx.lineTo(pts[i].x + pts[i].nx * pts[i].half * k, pts[i].y + pts[i].ny * pts[i].half * k);
      for (let i = steps; i >= 0; i--) ctx.lineTo(pts[i].x - pts[i].nx * pts[i].half * k, pts[i].y - pts[i].ny * pts[i].half * k);
      ctx.closePath();
    };

    const head = pts[0];
    const tail = pts[steps];

    // 1. Dark glass base keeps notes legible over bright scenery.
    if (base > 0) {
      const bg = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
      bg.addColorStop(0, 'rgba(4,6,14,0)');
      bg.addColorStop(0.35, `rgba(4,6,14,${base * 0.6})`);
      bg.addColorStop(1, `rgba(4,6,14,${base})`);
      ctx.fillStyle = bg;
      trace(1);
      ctx.fill();
    }

    // 2. Colour tint, deepest at the target.
    const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    grad.addColorStop(0, colorWithAlpha(col, 0));
    grad.addColorStop(0.55, colorWithAlpha(col, opts.fill * 0.6 + boost * 0.12));
    grad.addColorStop(1, colorWithAlpha(col, Math.min(0.9, opts.fill + boost * 0.4)));
    ctx.fillStyle = grad;
    trace(1);
    ctx.fill();

    // 3. Beat ticks: a tick for beat b sits exactly where a note on that beat would be.
    if (opts.ticks !== false) {
      const firstBeat = Math.floor(s.t / beatSec);
      const beatsAhead = Math.ceil(s.approachSec / beatSec) + 1;
      ctx.lineCap = 'round';
      for (let k = 0; k <= beatsAhead; k++) {
        const b = firstBeat + k;
        const p = 1 - (b * beatSec - s.t) / s.approachSec;
        if (p < p0 + 0.04 || p > 0.995) continue;
        const f = (p - p0) * steps / (1 - p0);
        const i0 = Math.min(steps - 1, Math.max(0, Math.floor(f)));
        const u = f - i0;
        const A = pts[i0];
        const B = pts[i0 + 1];
        const x = lerp(A.x, B.x, u);
        const y = lerp(A.y, B.y, u);
        const half = lerp(A.half, B.half, u) * 0.86;
        // Lanes running mostly up the screen get level ticks, which read as lines at a
        // constant depth; curving or sideways lanes tick across their own direction.
        const steep = Math.abs(B.y - A.y) > Math.abs(B.x - A.x) * 2;
        const nx = steep ? 1 : lerp(A.nx, B.nx, u);
        const ny = steep ? 0 : lerp(A.ny, B.ny, u);
        const tickHalf = steep ? lerp(A.w, B.w, u) * 0.42 : half;
        const isBar = b % 4 === 0;
        const a = (isBar ? 0.16 + p * 0.34 : 0.05 + p * 0.16) * (1 + boost * 0.6);
        ctx.strokeStyle = isBar ? `rgba(235,245,255,${a})` : colorWithAlpha(col, a * 1.4);
        ctx.lineWidth = (isBar ? 1.6 : 1) + p * (isBar ? 1.6 : 0.8);
        ctx.beginPath();
        ctx.moveTo(x + nx * tickHalf, y + ny * tickHalf);
        ctx.lineTo(x - nx * tickHalf, y - ny * tickHalf);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    // 4. Edges and core filament, added as light so they glow over the scene.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const edgeGrad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    edgeGrad.addColorStop(0, colorWithAlpha(col, 0));
    edgeGrad.addColorStop(0.6, colorWithAlpha(col, opts.edge * 0.45));
    edgeGrad.addColorStop(1, colorWithAlpha(col, Math.min(1, opts.edge + boost * 0.5)));
    ctx.strokeStyle = edgeGrad;
    ctx.lineWidth = 1.4 + boost * 2;
    ctx.beginPath();
    for (const side of [1, -1]) {
      ctx.moveTo(pts[0].x + side * pts[0].nx * pts[0].half, pts[0].y + side * pts[0].ny * pts[0].half);
      for (let i = 1; i <= steps; i++) ctx.lineTo(pts[i].x + side * pts[i].nx * pts[i].half, pts[i].y + side * pts[i].ny * pts[i].half);
    }
    ctx.stroke();
    if (!s.lite) {
      // Soft outer bloom on the edges near the player.
      ctx.strokeStyle = colorWithAlpha(col, 0.05 + boost * 0.1);
      ctx.lineWidth = 6 + boost * 6;
      ctx.stroke();
    }
    const coreGrad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    coreGrad.addColorStop(0, 'rgba(255,255,255,0)');
    coreGrad.addColorStop(1, `rgba(255,255,255,${0.10 + boost * 0.35})`);
    ctx.strokeStyle = coreGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= steps; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // 5. Receptor pool: light spilling onto the surface around the target.
    const pr = tail.half * (1.5 + boost * 0.6);
    const pool = ctx.createRadialGradient(tail.x, tail.y, 0, tail.x, tail.y, pr);
    pool.addColorStop(0, colorWithAlpha(col, 0.16 + s.beat * 0.06 + boost * 0.3));
    pool.addColorStop(1, colorWithAlpha(col, 0));
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(tail.x, tail.y, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function fillBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, stops: [number, string][], alpha = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function starfield(s: PovSceneInput, seed: number, count: number, color = '255,255,255') {
  const { ctx, W, H, t } = s;
  for (let i = 0; i < count; i++) {
    const x = hash(seed + i) * W;
    const y = hash(seed + i * 3.1) * H;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + hash(i) * 1.6) + i));
    ctx.fillStyle = `rgba(${color},${0.25 * tw})`;
    const r = 0.6 + hash(seed + i * 7.3) * 1.3;
    ctx.fillRect(x, y, r, r);
  }
}

// ── ORTHO 2D: piano-roll staff with beat lines that scroll at note speed ──
function drawFlat2D(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const trackW = geom.botWidth;
  const x0 = (W - trackW) / 2;

  fillBackdrop(ctx, W, H, [[0, 'rgba(6,10,18,0.55)'], [1, 'rgba(10,14,26,0.75)']]);

  // Flat panel
  ctx.fillStyle = 'rgba(8,12,22,0.82)';
  ctx.fillRect(x0, 0, trackW, hitY);
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const col = s.laneColors[lane] || '#00E5FF';
    const lx = x0 + lane * geom.laneW;
    const flash = hitFlash(s, lane);
    const g = ctx.createLinearGradient(0, 0, 0, hitY);
    g.addColorStop(0, colorWithAlpha(col, 0.02));
    g.addColorStop(1, colorWithAlpha(col, 0.10 + flash * 0.22 + (s.pressed[lane] ? 0.08 : 0)));
    ctx.fillStyle = g;
    ctx.fillRect(lx + 1, 0, geom.laneW - 2, hitY);
  }

  // Beat and bar lines: a line for beat b sits where a note at that time would be.
  const beatSec = 60 / Math.max(40, s.bpm || 120);
  const firstBeat = Math.floor(t / beatSec);
  const beatsAhead = Math.ceil(s.approachSec / beatSec) + 1;
  for (let k = 0; k <= beatsAhead; k++) {
    const b = firstBeat + k;
    const p = 1 - (b * beatSec - t) / s.approachSec;
    if (p < 0 || p > 1) continue;
    const y = p * hitY;
    const isBar = b % 4 === 0;
    ctx.fillStyle = isBar ? `rgba(220,235,255,${0.10 + p * 0.18})` : `rgba(220,235,255,${0.03 + p * 0.07})`;
    ctx.fillRect(x0, y - (isBar ? 1 : 0.5), trackW, isBar ? 2 : 1);
  }

  // Crisp lane dividers, no perspective, no glow
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let l = 1; l < LANE_COUNT; l++) ctx.fillRect(x0 + l * geom.laneW - 0.5, 0, 1, hitY);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x0 - 1, 0, 2, hitY);
  ctx.fillRect(x0 + trackW - 1, 0, 2, hitY);
}

// ── SIDE DRIFT: synthwave side-scroller with parallax ridges ──
function drawSideDrift(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const trackH = Math.min(H * 0.55, 360);
  const startY = (H - trackH) / 2;

  fillBackdrop(ctx, W, H, [[0, 'rgba(20,4,40,0.75)'], [0.55, 'rgba(60,10,70,0.55)'], [1, 'rgba(10,2,20,0.85)']]);
  starfield(s, 31, s.lite ? 25 : 60, '255,200,255');

  // Sun sitting behind the strike column
  const hit = proj(s, 'horizontal_drift', 1, 1);
  const sunR = Math.min(W, H) * 0.22;
  const sunY = startY + trackH * 0.5;
  const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sg.addColorStop(0, 'rgba(255,230,0,0.55)');
  sg.addColorStop(0.55, 'rgba(255,42,133,0.45)');
  sg.addColorStop(1, 'rgba(122,0,255,0.0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(hit.cx, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,4,40,0.55)';
  for (let i = 0; i < 6; i++) {
    const y = sunY + sunR * (0.1 + i * 0.15);
    ctx.fillRect(hit.cx - sunR, y, sunR * 2, 2 + i);
  }

  // Parallax ridges scroll opposite to note travel
  const layers: [number, string, number][] = [[0.18, 'rgba(70,10,90,0.55)', 40], [0.35, 'rgba(35,5,55,0.8)', 110]];
  for (const [amp, col, speed] of layers) {
    ctx.fillStyle = col;
    ctx.beginPath();
    const baseY = startY + trackH + 12;
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 24) {
      const k = (x + t * speed) / 90;
      const y = baseY - (Math.abs(Math.sin(k) * 0.6 + Math.sin(k * 2.3) * 0.4)) * H * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  // Floor grid below the lanes, rushing right
  ctx.strokeStyle = 'rgba(255,42,133,0.18)';
  ctx.lineWidth = 1;
  const gridY0 = startY + trackH + 6;
  const spacing = 48;
  for (let x = (t * 260) % spacing; x < W; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, gridY0);
    ctx.lineTo(x - (x - W / 2) * 0.4, H);
    ctx.stroke();
  }
  for (let k = 1; k <= 5; k++) {
    const y = gridY0 + (H - gridY0) * Math.pow(k / 5, 1.8);
    ctx.strokeStyle = `rgba(255,42,133,${0.08 + k * 0.03})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  drawLaneGuides(s, 'horizontal_drift', { fill: 0.20, edge: 0.6 });

  // Strike column through the three targets
  const top = proj(s, 'horizontal_drift', 2, 1);
  const bot = proj(s, 'horizontal_drift', 0, 1);
  const flash = anyHitFlash(s);
  ctx.strokeStyle = `rgba(255,255,255,${0.35 + s.beat * 0.25 + flash * 0.4})`;
  ctx.lineWidth = 2 + flash * 2;
  ctx.beginPath();
  ctx.moveTo(top.cx, top.cy - top.h * 0.2);
  ctx.lineTo(bot.cx, bot.cy + bot.h);
  ctx.stroke();
}

// ── PILOT HUD: hyperspace streaks behind a canopy frame and flight instruments ──
function drawCockpit(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vx = W / 2;
  const vy = hitY * 0.22;
  const hud = '108,255,176';

  fillBackdrop(ctx, W, H, [[0, 'rgba(2,8,14,0.85)'], [1, 'rgba(4,14,18,0.8)']]);

  starfield(s, 23, s.lite ? 30 : 70, '200,240,255');
  // Distant gas giant off to one side, drifting with the roll
  const gpx = W * 0.82 + Math.sin(t * 0.1) * 8;
  const gpy = H * 0.2;
  const gpr = Math.min(W, H) * 0.09;
  const gp = ctx.createRadialGradient(gpx - gpr * 0.4, gpy - gpr * 0.4, gpr * 0.1, gpx, gpy, gpr);
  gp.addColorStop(0, 'rgba(120,200,190,0.55)');
  gp.addColorStop(1, 'rgba(10,40,50,0.5)');
  ctx.fillStyle = gp;
  ctx.beginPath();
  ctx.arc(gpx, gpy, gpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,230,220,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(gpx, gpy, gpr * 1.7, gpr * 0.35, -0.3, 0, Math.PI * 2);
  ctx.stroke();

  // Hyperspace streaks radiating from the vanishing point
  const n = s.lite ? 40 : 90;
  const speed = 0.55 + s.energy * 0.6 + (s.stage >= 5 ? 0.5 : 0);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ang = hash(i) * Math.PI * 2;
    const z = (hash(i * 5.7) + t * speed * (0.3 + hash(i * 2.3) * 0.5)) % 1;
    const r1 = Math.pow(z, 2.2) * Math.max(W, H) * 0.9;
    const r2 = r1 * (1.08 + z * 0.25);
    ctx.strokeStyle = `rgba(200,240,255,${z * 0.55})`;
    ctx.lineWidth = 0.5 + z * 1.8;
    ctx.beginPath();
    ctx.moveTo(vx + Math.cos(ang) * r1, vy + Math.sin(ang) * r1 * 0.75);
    ctx.lineTo(vx + Math.cos(ang) * r2, vy + Math.sin(ang) * r2 * 0.75);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  drawLaneGuides(s, 'cockpit_hud', { fill: 0.12, edge: 0.35 });

  // Artificial horizon follows the same g-force roll as the notes
  const roll = Math.sin(t * 1.5) * 0.03;
  ctx.save();
  ctx.translate(vx, vy);
  ctx.rotate(roll);
  ctx.strokeStyle = `rgba(${hud},0.35)`;
  ctx.lineWidth = 1.2;
  const span = geom.stageW * 0.75;
  ctx.beginPath();
  ctx.moveTo(-span, 0);
  ctx.lineTo(-geom.stageW * 0.12, 0);
  ctx.moveTo(geom.stageW * 0.12, 0);
  ctx.lineTo(span, 0);
  ctx.stroke();
  // Pitch ladder
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillStyle = `rgba(${hud},0.45)`;
  const ladderOff = (t * 40) % 36;
  for (let i = -1; i < 6; i++) {
    const y = i * 36 + ladderOff + 30;
    const a = Math.max(0, 0.4 - i * 0.05);
    ctx.strokeStyle = `rgba(${hud},${a})`;
    ctx.beginPath();
    ctx.moveTo(-geom.stageW * 0.62, y);
    ctx.lineTo(-geom.stageW * 0.54, y);
    ctx.moveTo(geom.stageW * 0.54, y);
    ctx.lineTo(geom.stageW * 0.62, y);
    ctx.stroke();
  }
  ctx.restore();

  // Heading tape across the top of the canopy
  ctx.save();
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'center';
  const tapeY = H * 0.11;
  const tapeHalf = geom.stageW * 0.4;
  const heading = (t * 12) % 360;
  ctx.strokeStyle = `rgba(${hud},0.3)`;
  ctx.lineWidth = 1;
  for (let d = -40; d <= 40; d += 5) {
    const deg = Math.round(heading / 5) * 5 + d;
    const x = vx + ((deg - heading) / 40) * tapeHalf;
    if (Math.abs(x - vx) > tapeHalf) continue;
    const major = ((deg % 30) + 30) % 30 === 0;
    ctx.beginPath();
    ctx.moveTo(x, tapeY);
    ctx.lineTo(x, tapeY + (major ? 8 : 4));
    ctx.stroke();
    if (major) {
      ctx.fillStyle = `rgba(${hud},0.45)`;
      ctx.fillText(String(((deg % 360) + 360) % 360).padStart(3, '0'), x, tapeY - 3);
    }
  }
  ctx.fillStyle = `rgba(${hud},0.7)`;
  ctx.beginPath();
  ctx.moveTo(vx, tapeY + 10);
  ctx.lineTo(vx - 4, tapeY + 16);
  ctx.lineTo(vx + 4, tapeY + 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Targeting brackets framing the playfield
  const bx0 = (W - geom.stageW) / 2;
  const bx1 = (W + geom.stageW) / 2;
  const by0 = hitY * 0.3;
  const by1 = hitY + 30;
  const bl = 18;
  ctx.strokeStyle = `rgba(${hud},${0.28 + s.beat * 0.15})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const [x, y, dx, dy] of [[bx0, by0, 1, 1], [bx1, by0, -1, 1], [bx0, by1, 1, -1], [bx1, by1, -1, -1]] as const) {
    ctx.moveTo(x, y + dy * bl);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * bl, y);
  }
  ctx.stroke();

  // Reticle pulses on the beat and locks on hits
  const flash = anyHitFlash(s);
  const rr = 18 + s.beat * 4 - flash * 4;
  ctx.strokeStyle = `rgba(${hud},${0.55 + flash * 0.45})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(vx, vy, rr, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(vx + Math.cos(a) * (rr + 4), vy + Math.sin(a) * (rr + 4));
    ctx.lineTo(vx + Math.cos(a) * (rr + 12), vy + Math.sin(a) * (rr + 12));
    ctx.stroke();
  }

  // Side gauges: speed and throttle tapes
  const gx = (W - geom.stageW) / 2 - 18;
  const gx2 = (W + geom.stageW) / 2 + 18;
  if (gx > 40) {
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = `rgba(${hud},0.55)`;
    ctx.textAlign = 'right';
    ctx.fillText(`SPD ${Math.round(880 + s.energy * 400 + Math.sin(t * 2) * 6)}`, gx, hitY * 0.55);
    ctx.textAlign = 'left';
    ctx.fillText(`BPM ${Math.round(s.bpm)}`, gx2, hitY * 0.55);
    ctx.textAlign = 'start';
    const tapeH = hitY * 0.32;
    ctx.strokeStyle = `rgba(${hud},0.3)`;
    ctx.strokeRect(gx - 8, hitY * 0.6, 8, tapeH);
    ctx.fillStyle = `rgba(${hud},0.45)`;
    const fillH = tapeH * (0.35 + s.energy * 0.6);
    ctx.fillRect(gx - 8, hitY * 0.6 + tapeH - fillH, 8, fillH);
  }

  // Canopy frame: two struts and a top bow, kept outside the playfield
  ctx.save();
  ctx.strokeStyle = 'rgba(8,12,16,0.92)';
  ctx.lineWidth = Math.max(14, W * 0.02);
  ctx.beginPath();
  ctx.moveTo(-10, H * 0.06);
  ctx.quadraticCurveTo(W / 2, -H * 0.06, W + 10, H * 0.06);
  ctx.moveTo((W - geom.stageW) / 2 - geom.stageW * 0.18, -10);
  ctx.quadraticCurveTo((W - geom.stageW) / 2 - geom.stageW * 0.30, H * 0.5, -10, H * 0.98);
  ctx.moveTo((W + geom.stageW) / 2 + geom.stageW * 0.18, -10);
  ctx.quadraticCurveTo((W + geom.stageW) / 2 + geom.stageW * 0.30, H * 0.5, W + 10, H * 0.98);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${hud},0.18)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// ── HYPER PRISM: rotating kaleidoscope with spectral beams fanning from a prism ──
function drawPrism(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vx = W / 2;
  const vy = hitY * 0.30;
  const flash = anyHitFlash(s);
  const hueBase = (t * 24 + flash * 40) % 360;

  fillBackdrop(ctx, W, H, [[0, 'rgba(8,4,20,0.8)'], [1, 'rgba(4,2,12,0.85)']]);

  // Kaleidoscope: mirrored shards around the vanishing point
  const shards = s.lite ? 8 : 12;
  const R = Math.max(W, H) * 0.75 * (1 + s.beat * 0.04);
  ctx.save();
  ctx.translate(vx, vy);
  ctx.rotate(t * 0.18);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < shards; i++) {
    const a0 = (i / shards) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / shards;
    const hue = (hueBase + i * (360 / shards)) % 360;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `hsla(${hue},90%,60%,0.0)`);
    g.addColorStop(0.35, `hsla(${hue},90%,60%,${i % 2 ? 0.05 : 0.09})`);
    g.addColorStop(1, `hsla(${hue},90%,50%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
    ctx.lineTo(Math.cos((a0 + a1) / 2) * R * 0.7, Math.sin((a0 + a1) / 2) * R * 0.7);
    ctx.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Spectral beams fanning toward the player
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beams = 7;
  for (let i = 0; i < beams; i++) {
    const hue = (i / beams) * 300;
    const spread = (i - (beams - 1) / 2) / ((beams - 1) / 2);
    const bx = vx + spread * geom.stageW * 0.95;
    const g = ctx.createLinearGradient(vx, vy, bx, H);
    g.addColorStop(0, `hsla(${hue},100%,65%,${0.22 + flash * 0.2})`);
    g.addColorStop(1, `hsla(${hue},100%,55%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(bx - geom.stageW * 0.06, H);
    ctx.lineTo(bx + geom.stageW * 0.06, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  drawLaneGuides(s, 'hyper_prism', { fill: 0.14, edge: 0.5 });

  // The prism itself
  const ps = 22 + s.beat * 4;
  ctx.save();
  ctx.translate(vx, vy);
  ctx.rotate(Math.sin(t * 0.7) * 0.25);
  // Glow behind the crystal
  const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, ps * 3.2);
  pg.addColorStop(0, `rgba(255,255,255,${0.25 + s.beat * 0.15 + flash * 0.3})`);
  pg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(0, 0, ps * 3.2, 0, Math.PI * 2);
  ctx.fill();
  // Three faces of a tetrahedral prism; the apex turns slowly so faces trade light
  const spin = t * 0.9;
  const verts = [0, 1, 2].map((k) => {
    const a = spin + (k / 3) * Math.PI * 2;
    return { x: Math.cos(a) * ps * 0.95, y: ps * 0.55 + Math.sin(a) * ps * 0.28, depth: Math.sin(a) };
  });
  const top = { x: 0, y: -ps * 1.05 };
  const faces = [[0, 1], [1, 2], [2, 0]]
    .map(([i, j]) => ({ i, j, depth: (verts[i].depth + verts[j].depth) / 2 }))
    .sort((a, b) => a.depth - b.depth);
  for (const f of faces) {
    const hue = (hueBase + f.i * 120) % 360;
    const lum = 30 + (f.depth + 1) * 22;
    ctx.fillStyle = `hsla(${hue},80%,${lum}%,${0.35 + (f.depth + 1) * 0.15})`;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(verts[f.i].x, verts[f.i].y);
    ctx.lineTo(verts[f.j].x, verts[f.j].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + flash * 0.4})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

// ── DNA HELIX: twin double-helix towers flanking the lanes ──
function drawDna(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const geom = getStageGeometry(W, H);
  const colA = '#2EF2C9';
  const colB = '#FF4FD8';

  fillBackdrop(ctx, W, H, [[0, 'rgba(2,14,20,0.82)'], [1, 'rgba(8,4,22,0.85)']]);

  // Floating cells (bokeh)
  const cells = s.lite ? 8 : 18;
  for (let i = 0; i < cells; i++) {
    const x = hash(i * 1.7) * W;
    const y = ((hash(i * 4.1) * H) + t * (10 + hash(i) * 18)) % (H + 80) - 40;
    const r = 8 + hash(i * 9.2) * 28;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, i % 2 ? 'rgba(46,242,201,0.10)' : 'rgba(255,79,216,0.09)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Two towers, one per side, scrolling toward the player
  const towers = [W / 2 - geom.stageW * 0.62, W / 2 + geom.stageW * 0.62];
  const amp = Math.min(70, geom.stageW * 0.11);
  const pitch = 140;
  const scroll = t * 90 * (s.stage >= 5 ? 1.8 : 1);
  for (let ti = 0; ti < towers.length; ti++) {
    const tx = towers[ti];
    if (tx < -amp || tx > W + amp) continue;
    const phase0 = ti * Math.PI;
    // Rungs first so strands draw over them
    const pairCols = ['#FFD166', '#4CC9F0', '#F72585', '#80FFDB'];
    for (let y = -((scroll) % 22); y < H; y += 22) {
      const ph = ((y + scroll) / pitch) * Math.PI * 2 + phase0;
      const x1 = tx + Math.sin(ph) * amp;
      const x2 = tx - Math.sin(ph) * amp;
      const depth = Math.abs(Math.cos(ph));
      const idx = Math.floor((y + scroll) / 22);
      const pc = pairCols[((idx % 4) + 4) % 4];
      // Each rung is two half base-pairs meeting in the middle
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = colorWithAlpha(pc, 0.10 + depth * 0.22);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo((x1 + x2) / 2, y);
      ctx.stroke();
      ctx.strokeStyle = colorWithAlpha(pairCols[((idx + 2) % 4 + 4) % 4], 0.10 + depth * 0.22);
      ctx.beginPath();
      ctx.moveTo((x1 + x2) / 2, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }
    // Strands: segment by segment so the half turning away dims and thins
    for (let strand = 0; strand < 2; strand++) {
      const sc = strand ? colB : colA;
      let px = 0;
      let py = 0;
      for (let y = -10; y <= H + 10; y += 6) {
        const ph = ((y + scroll) / pitch) * Math.PI * 2 + phase0;
        const x = tx + (strand ? -1 : 1) * Math.sin(ph) * amp;
        const near = (strand ? -1 : 1) * Math.cos(ph); // +1 facing the camera
        if (y > -10) {
          ctx.strokeStyle = colorWithAlpha(sc, 0.25 + Math.max(0, near) * 0.55);
          ctx.lineWidth = 2 + Math.max(0, near) * 2.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        px = x;
        py = y;
      }
      // Glowing backbone nodes on the near side
      if (!s.lite) {
        for (let y = -((scroll) % 22); y < H; y += 22) {
          const ph = ((y + scroll) / pitch) * Math.PI * 2 + phase0;
          const near = (strand ? -1 : 1) * Math.cos(ph);
          if (near < 0.2) continue;
          const x = tx + (strand ? -1 : 1) * Math.sin(ph) * amp;
          ctx.fillStyle = colorWithAlpha(sc, 0.35 + near * 0.5 + s.beat * 0.1);
          ctx.beginPath();
          ctx.arc(x, y, 2 + near * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  drawLaneGuides(s, 'dna_helix', { fill: 0.11, edge: 0.45, base: 0.4 });

  // Hit bursts release a short-lived nucleotide spark ring at the target
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const f = hitFlash(s, lane);
    if (f <= 0) continue;
    const a = proj(s, 'dna_helix', lane, 1);
    ctx.strokeStyle = colorWithAlpha(lane % 2 ? colB : colA, f * 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(a.cx, a.cy, a.w * (0.6 + (1 - f) * 0.5), a.w * (0.25 + (1 - f) * 0.2), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── VERTIGO DROP: freefall down a skyscraper canyon ──
function drawVertigo(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vx = W / 2;
  const vy = hitY * 0.12;

  fillBackdrop(ctx, W, H, [[0, 'rgba(1,3,10,0.9)'], [1, 'rgba(6,12,28,0.85)']]);

  // City glow far below at the vanishing point
  const cg = ctx.createRadialGradient(vx, vy, 0, vx, vy, geom.stageW * 0.3);
  cg.addColorStop(0, 'rgba(255,170,60,0.55)');
  cg.addColorStop(0.3, 'rgba(255,120,40,0.15)');
  cg.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, W, H);

  // Facade walls: dark glass sides of the shaft converging on the vanishing point
  const farHw = geom.stageW * 0.05;
  for (const side of [-1, 1]) {
    const wg = ctx.createLinearGradient(vx, vy, vx + side * W * 0.5, vy);
    wg.addColorStop(0, 'rgba(10,18,40,0.0)');
    wg.addColorStop(0.3, 'rgba(12,22,48,0.55)');
    wg.addColorStop(1, 'rgba(6,10,24,0.85)');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(vx + side * farHw, vy);
    ctx.lineTo(vx + side * W, -H * 0.6);
    ctx.lineTo(vx + side * W, H * 2);
    ctx.closePath();
    ctx.fill();
    // Vertical mullions converging on the vanishing point
    ctx.strokeStyle = 'rgba(120,160,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let m = 1; m <= 6; m++) {
      const ex = vx + side * (farHw + (W * 0.75) * (m / 6));
      ctx.moveTo(vx + side * farHw, vy);
      ctx.lineTo(ex, H * 1.4);
      ctx.moveTo(vx + side * farHw, vy);
      ctx.lineTo(ex, -H * 0.4);
    }
    ctx.stroke();
  }

  // Building floors rush past: each floor is a rectangle ring growing out of the vanishing point
  const floors = s.lite ? 10 : 18;
  const fall = t * (0.35 + s.energy * 0.25) * (s.stage >= 5 ? 1.7 : 1);
  const farHalfW = geom.stageW * 0.05;
  const nearHalfW = W * 0.75;
  for (let i = 0; i < floors; i++) {
    const z = ((i / floors) + fall) % 1;
    const p = Math.pow(z, 2.2);
    const hw = lerp(farHalfW, nearHalfW, p);
    const top = lerp(vy, -H * 0.4, p);
    const bot = lerp(vy, H * 1.6, p);
    const a = Math.min(1, z * 2.5) * (1 - Math.max(0, z - 0.85) / 0.15);
    // Facade edges (left/right walls)
    ctx.strokeStyle = `rgba(120,160,255,${0.10 * a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vx - hw, top);
    ctx.lineTo(vx - hw, bot);
    ctx.moveTo(vx + hw, top);
    ctx.lineTo(vx + hw, bot);
    ctx.stroke();
    // Lit windows on both facades
    // Floor slab line across each wall
    ctx.strokeStyle = `rgba(120,160,255,${0.08 * a})`;
    ctx.beginPath();
    ctx.moveTo(vx - hw, top);
    ctx.lineTo(vx - W, top - (W - hw) * 0.8);
    ctx.moveTo(vx + hw, top);
    ctx.lineTo(vx + W, top - (W - hw) * 0.8);
    ctx.stroke();
    const winW = Math.max(1.5, hw * 0.05);
    const rows = s.lite ? 5 : 8;
    for (let r = 0; r < rows; r++) {
      const wy = lerp(top, bot, (r + 0.5) / rows);
      for (const side of [-1, 1]) {
        const seed = i * 13 + r * 3 + (side > 0 ? 1 : 0) + Math.floor((t + i) / 7) * 101;
        if (hash(seed) < 0.55) continue;
        const warm = hash(seed * 1.3) > 0.4;
        ctx.fillStyle = warm ? `rgba(255,200,120,${0.45 * a})` : `rgba(140,200,255,${0.4 * a})`;
        ctx.fillRect(vx + side * hw - (side > 0 ? 0 : winW), wy, winW, winW * 1.4);
      }
    }
  }

  // Wind streaks
  ctx.strokeStyle = 'rgba(200,220,255,0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i < (s.lite ? 10 : 24); i++) {
    const x = hash(i * 2.9) * W;
    const y = ((hash(i * 6.1) * H) - t * (500 + hash(i) * 300)) % H;
    const yy = y < 0 ? y + H : y;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x, yy + 30 + hash(i) * 50);
    ctx.stroke();
  }

  drawLaneGuides(s, 'vertigo_drop', { fill: 0.15, edge: 0.5 });
}

// ── SINGULARITY: black hole with accretion disk at the vanishing point ──
function drawSingularity(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vx = W / 2;
  const vy = hitY * 0.28;
  const flash = anyHitFlash(s);
  const R = geom.stageW * 0.085;

  fillBackdrop(ctx, W, H, [[0, 'rgba(2,1,6,0.9)'], [1, 'rgba(6,2,10,0.88)']]);
  starfield(s, 41, s.lite ? 30 : 80, '255,236,210');

  // Warm nebula wash around the hole
  const neb = ctx.createRadialGradient(vx, vy, R, vx, vy, geom.stageW * 1.1);
  neb.addColorStop(0, 'rgba(120,40,20,0.22)');
  neb.addColorStop(0.5, 'rgba(60,14,40,0.12)');
  neb.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, W, H);

  // Gravity well: spacetime grid rings sinking toward the hole, flowing inward
  ctx.lineWidth = 1;
  const wells = s.lite ? 6 : 10;
  for (let i = 0; i < wells; i++) {
    const z = ((i / wells) + t * 0.12) % 1;
    const rr = lerp(geom.stageW * 1.25, R * 1.6, Math.pow(z, 0.8));
    const sink = Math.pow(z, 2) * H * 0.05;
    ctx.strokeStyle = `rgba(255,170,110,${0.03 + (1 - z) * z * 0.22})`;
    ctx.beginPath();
    ctx.ellipse(vx, vy + sink + rr * 0.08, rr, rr * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Relativistic jets shooting from the poles
  if (!s.lite) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const jl = H * 0.5;
    for (const dir of [-1, 1]) {
      const jg = ctx.createLinearGradient(vx, vy, vx, vy + dir * jl);
      jg.addColorStop(0, `rgba(170,200,255,${0.35 + s.beat * 0.15 + flash * 0.2})`);
      jg.addColorStop(1, 'rgba(120,160,255,0)');
      ctx.fillStyle = jg;
      const wob = Math.sin(t * 3 + dir) * R * 0.08;
      ctx.beginPath();
      ctx.moveTo(vx - R * 0.12, vy);
      ctx.lineTo(vx + wob - R * 0.45, vy + dir * jl);
      ctx.lineTo(vx + wob + R * 0.45, vy + dir * jl);
      ctx.lineTo(vx + R * 0.12, vy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Infalling debris spiralling in
  const n = s.lite ? 24 : 60;
  for (let i = 0; i < n; i++) {
    const life = (hash(i * 3.3) + t * (0.08 + hash(i) * 0.08)) % 1;
    const r = lerp(geom.stageW * 0.9, R * 1.2, Math.pow(life, 0.7));
    const ang = hash(i * 8.8) * Math.PI * 2 + life * 6 + t * 0.2;
    const x = vx + Math.cos(ang) * r;
    const y = vy + Math.sin(ang) * r * 0.32;
    ctx.fillStyle = `rgba(255,${180 + Math.round(life * 60)},120,${life * 0.6})`;
    ctx.fillRect(x, y, 1.6, 1.6);
  }

  const heat = Math.min(1, 0.55 + s.beat * 0.2 + flash * 0.35);
  const drawDisk = (alpha: number) => {
    ctx.save();
    ctx.translate(vx, vy);
    ctx.scale(1, 0.2);
    const disk = ctx.createRadialGradient(0, 0, R * 1.05, 0, 0, R * 5.2);
    disk.addColorStop(0, `rgba(255,248,230,${0.95 * heat * alpha})`);
    disk.addColorStop(0.18, `rgba(255,196,110,${0.75 * heat * alpha})`);
    disk.addColorStop(0.55, `rgba(255,96,40,${0.28 * heat * alpha})`);
    disk.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = disk;
    ctx.beginPath();
    ctx.arc(0, 0, R * 5.2, 0, Math.PI * 2);
    ctx.fill();
    // Orbiting hot streaks, inner ones faster
    const streaks = s.lite ? 6 : 14;
    ctx.lineCap = 'round';
    for (let k = 0; k < streaks; k++) {
      const rr = R * (1.3 + hash(k * 4.4) * 3.4);
      const start = hash(k * 2.7) * Math.PI * 2 + t * (2.6 / (rr / R));
      ctx.strokeStyle = `rgba(255,236,200,${0.45 * heat * alpha})`;
      ctx.lineWidth = R * 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, rr, start, start + 0.5 + hash(k) * 0.6);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.restore();
  };

  // Light from the far side of the disk, bent up and over the hole
  ctx.save();
  ctx.translate(vx, vy);
  ctx.scale(1, 0.92);
  const halo = ctx.createRadialGradient(0, 0, R * 1.02, 0, 0, R * 2.3);
  halo.addColorStop(0, `rgba(255,240,215,${0.85 * heat})`);
  halo.addColorStop(0.22, `rgba(255,170,80,${0.5 * heat})`);
  halo.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, R * 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawDisk(1);

  // Doppler beaming: the side spinning toward us glows hotter
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(vx, vy);
  ctx.scale(1, 0.2);
  const dop = ctx.createLinearGradient(-R * 5, 0, R * 5, 0);
  dop.addColorStop(0, `rgba(255,230,190,${0.32 * heat})`);
  dop.addColorStop(0.5, 'rgba(255,200,140,0)');
  dop.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = dop;
  ctx.beginPath();
  ctx.arc(0, 0, R * 4.6, 0, Math.PI * 2);
  ctx.arc(0, 0, R * 1.1, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.restore();

  // Event horizon and photon ring
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(vx, vy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,240,220,${0.75 + flash * 0.25})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(vx, vy, R * 1.04, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(200,220,255,${0.10 + s.beat * 0.08})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(vx, vy, R * 1.55 + Math.sin(t * 2) * 1.5, 0, Math.PI * 2);
  ctx.stroke();

  // Near side of the disk passes in front of the hole
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, vy, W, H);
  ctx.clip();
  drawDisk(0.9);
  ctx.restore();

  drawLaneGuides(s, 'singularity_void', { fill: 0.12, edge: 0.4, startP: 0.08 });
}

// ── GROUND ZERO: low bumper-cam on a night street with a city skyline ──
function drawGroundZero(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const horizon = hitY * 0.42;
  const vx = W / 2;

  // Dusk sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, 'rgba(14,6,36,0.9)');
  sky.addColorStop(0.7, 'rgba(90,24,80,0.8)');
  sky.addColorStop(1, 'rgba(255,110,60,0.75)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);

  // Skyline silhouette
  ctx.fillStyle = 'rgba(10,4,20,0.95)';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  let x = 0;
  let i = 0;
  while (x < W) {
    const bw = 18 + hash(i * 2.1) * 46;
    const bh = 10 + hash(i * 5.3) * horizon * 0.35;
    ctx.lineTo(x, horizon - bh);
    ctx.lineTo(x + bw, horizon - bh);
    x += bw;
    i++;
  }
  ctx.lineTo(W, horizon);
  ctx.closePath();
  ctx.fill();
  // Skyline windows
  for (let k = 0; k < (s.lite ? 20 : 60); k++) {
    const wx = hash(k * 3.7) * W;
    const wy = horizon - hash(k * 1.9) * horizon * 0.3;
    if (hash(k + Math.floor(t / 3)) < 0.3) continue;
    ctx.fillStyle = 'rgba(255,210,140,0.45)';
    ctx.fillRect(wx, wy, 2, 2);
  }

  // Asphalt
  const road = ctx.createLinearGradient(0, horizon, 0, H);
  road.addColorStop(0, 'rgba(20,16,26,0.95)');
  road.addColorStop(1, 'rgba(10,8,14,0.95)');
  ctx.fillStyle = road;
  ctx.fillRect(0, horizon, W, H - horizon);

  // Road edges follow the outer lanes' paths
  const lEdge = laneAt(0, 1, W, 0.26, 0.94, undefined, 1, 0, H);
  const rEdge = laneAt(2, 1, W, 0.26, 0.94, undefined, 1, 0, H);
  const farHalf = geom.stageW * 0.12;
  ctx.strokeStyle = 'rgba(255,200,80,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(vx - farHalf, horizon);
  ctx.lineTo(lEdge.x - 10, hitY);
  ctx.lineTo(lEdge.x - 10 - (lEdge.x - vx) * 0.35, H);
  ctx.moveTo(vx + farHalf, horizon);
  ctx.lineTo(rEdge.x + rEdge.w + 10, hitY);
  ctx.lineTo(rEdge.x + rEdge.w + 10 + (rEdge.x + rEdge.w - vx) * 0.35, H);
  ctx.stroke();

  // Street lamps passing on both sides
  const lamps = 6;
  const drive = t * (0.45 + s.energy * 0.3);
  for (let k = 0; k < lamps; k++) {
    const z = ((k / lamps) + drive) % 1;
    const p = Math.pow(z, 1.6);
    const y = lerp(horizon, H * 1.1, p);
    const off = lerp(farHalf * 1.6, W * 0.75, p);
    const poleH = lerp(6, H * 0.5, p);
    const a = Math.min(1, z * 3);
    for (const side of [-1, 1]) {
      const px = vx + side * off;
      ctx.strokeStyle = `rgba(60,50,70,${a})`;
      ctx.lineWidth = lerp(1, 6, p);
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, y - poleH);
      ctx.stroke();
      const lg = ctx.createRadialGradient(px, y - poleH, 0, px, y - poleH, lerp(4, 70, p));
      lg.addColorStop(0, `rgba(255,220,150,${0.8 * a})`);
      lg.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(px, y - poleH, lerp(4, 70, p), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Wet asphalt: lamp reflections smeared down the road
  for (let k = 0; k < lamps; k++) {
    const z = ((k / lamps) + drive) % 1;
    const p = Math.pow(z, 1.6);
    const y = lerp(horizon, H * 1.1, p);
    const off = lerp(farHalf * 1.6, W * 0.75, p);
    const a = Math.min(1, z * 3) * 0.18;
    for (const side of [-1, 1]) {
      const px = vx + side * off * 0.85;
      const rg = ctx.createLinearGradient(0, y, 0, y + lerp(10, 160, p));
      rg.addColorStop(0, `rgba(255,210,140,${a})`);
      rg.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(px - lerp(1, 8, p), y, lerp(2, 16, p), lerp(10, 160, p));
    }
  }
  // Tail lights of traffic far ahead
  for (let k = 0; k < 3; k++) {
    const tx = vx + (k - 1) * farHalf * 0.6 + Math.sin(t * 0.5 + k) * 3;
    const ty = horizon + 6 + k * 2;
    ctx.fillStyle = `rgba(255,40,60,${0.55 + 0.25 * Math.sin(t * 3 + k)})`;
    ctx.fillRect(tx - 3, ty, 2, 1.5);
    ctx.fillRect(tx + 1, ty, 2, 1.5);
  }

  drawLaneGuides(s, 'ground_zero', { fill: 0.16, edge: 0.55 });

  // Bumper shockwave on hit
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const f = hitFlash(s, lane);
    if (f <= 0) continue;
    const a = proj(s, 'ground_zero', lane, 1);
    const rx = a.w * (0.5 + (1 - f) * 1.4);
    ctx.strokeStyle = `rgba(255,200,80,${f * 0.7})`;
    ctx.lineWidth = 3 * f + 1;
    ctx.beginPath();
    ctx.ellipse(a.cx, a.cy, rx, rx * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── STARGATE HALO: a giant ring gate whose chevrons light on the beat ──
function drawHalo(s: PovSceneInput) {
  const { ctx, W, H, t, bpm } = s;
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const gx = W / 2;
  const gy = hitY * 0.16;
  const rx = geom.stageW * 0.42;
  const ry = rx * 0.36;
  const flash = anyHitFlash(s);

  fillBackdrop(ctx, W, H, [[0, 'rgba(2,6,22,0.85)'], [1, 'rgba(2,10,24,0.85)']]);
  starfield(s, 77, s.lite ? 40 : 110, '200,220,255');

  // Planet limb glowing at the bottom of the frame
  const pr = Math.max(W, H) * 1.1;
  const py = H + pr * 0.86;
  // Night-side planet body with city lights
  const body = ctx.createRadialGradient(gx, py - pr * 0.6, pr * 0.2, gx, py, pr);
  body.addColorStop(0, 'rgba(14,30,60,0.95)');
  body.addColorStop(1, 'rgba(4,10,24,0.95)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(gx, py, pr, 0, Math.PI * 2);
  ctx.fill();
  for (let k = 0; k < (s.lite ? 20 : 60); k++) {
    const ang = -Math.PI / 2 + (hash(k * 2.3) - 0.5) * 0.9;
    const rr = pr * (0.985 - hash(k * 5.1) * 0.03);
    const lx = gx + Math.cos(ang + t * 0.004) * rr;
    const ly = py + Math.sin(ang + t * 0.004) * rr;
    if (ly > H || ly < 0) continue;
    ctx.fillStyle = `rgba(255,200,120,${0.25 + hash(k) * 0.35})`;
    ctx.fillRect(lx, ly, 1.5, 1.5);
  }
  const atm = ctx.createRadialGradient(gx, py, pr * 0.96, gx, py, pr * 1.04);
  atm.addColorStop(0, 'rgba(60,140,255,0.0)');
  atm.addColorStop(0.5, 'rgba(90,170,255,0.28)');
  atm.addColorStop(1, 'rgba(90,170,255,0)');
  ctx.fillStyle = atm;
  ctx.fillRect(0, 0, W, H);

  // Event horizon shimmer inside the ring
  const inner = ctx.createRadialGradient(gx, gy, 0, gx, gy, rx);
  inner.addColorStop(0, `rgba(140,200,255,${0.16 + flash * 0.2})`);
  inner.addColorStop(0.7, 'rgba(80,140,255,0.06)');
  inner.addColorStop(1, 'rgba(80,140,255,0)');
  ctx.save();
  ctx.translate(gx, gy);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  // Ripples flowing out of the gate on the beat
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) {
    const z = ((k / 4) + t * 0.35) % 1;
    ctx.strokeStyle = `rgba(170,215,255,${(1 - z) * (0.18 + flash * 0.2)})`;
    ctx.beginPath();
    ctx.arc(0, 0, rx * z, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Ring body: brushed metal, lit from above
  const metal = ctx.createLinearGradient(0, gy - ry, 0, gy + ry);
  metal.addColorStop(0, 'rgba(210,225,245,0.75)');
  metal.addColorStop(0.5, 'rgba(90,105,130,0.6)');
  metal.addColorStop(1, 'rgba(150,170,200,0.7)');
  ctx.strokeStyle = metal;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Segment seams
  ctx.strokeStyle = 'rgba(20,26,40,0.7)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + t * 0.05;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(gx + c * (rx - 6), gy + sn * (ry - 6 * ry / rx));
    ctx.lineTo(gx + c * (rx + 6), gy + sn * (ry + 6 * ry / rx));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(220,235,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(gx, gy, rx + 5, ry + 5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Chevrons light up one per beat, all on a hit
  const chevrons = 9;
  const beatIdx = Math.floor(t * (bpm / 60));
  for (let c = 0; c < chevrons; c++) {
    const a = (c / chevrons) * Math.PI * 2 - Math.PI / 2 + t * 0.05;
    const x = gx + Math.cos(a) * rx;
    const y = gy + Math.sin(a) * ry;
    const lit = ((beatIdx % chevrons) >= c) || flash > 0.2;
    ctx.fillStyle = lit ? `rgba(255,150,60,${0.7 + s.beat * 0.3})` : 'rgba(90,60,40,0.6)';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(0, 5);
    ctx.lineTo(6, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawLaneGuides(s, 'orbital_halo', { fill: 0.13, edge: 0.45 });
}

// ── MÖBIUS LOOP: a twisting band that mirrors the notes' twist, plus an infinity comet ──
function drawMobius(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vy = hitY * 0.26;
  const front = '#9D7BFF';
  const back = '#FF7BB0';

  fillBackdrop(ctx, W, H, [[0, 'rgba(10,4,24,0.85)'], [1, 'rgba(14,4,20,0.85)']]);
  starfield(s, 59, s.lite ? 25 : 60, '220,200,255');

  // Infinity curve behind everything
  const cx = W / 2;
  const cy = vy;
  const a = geom.stageW * 0.62;
  ctx.strokeStyle = 'rgba(180,160,255,0.16)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const u = (i / 120) * Math.PI * 2;
    const d = 1 + Math.sin(u) * Math.sin(u);
    const x = cx + (a * Math.cos(u)) / d;
    const y = cy + (a * Math.sin(u) * Math.cos(u)) / d;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Comet tracing the loop
  for (let k = 0; k < 14; k++) {
    const u = t * 1.2 - k * 0.04;
    const d = 1 + Math.sin(u) * Math.sin(u);
    const x = cx + (a * Math.cos(u)) / d;
    const y = cy + (a * Math.sin(u) * Math.cos(u)) / d;
    if (k === 0) {
      const cg = ctx.createRadialGradient(x, y, 0, x, y, 22);
      cg.addColorStop(0, 'rgba(220,200,255,0.5)');
      cg.addColorStop(1, 'rgba(220,200,255,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255,255,255,${(1 - k / 14) * 0.8})`;
    ctx.beginPath();
    ctx.arc(x, y, 4 * (1 - k / 14) + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Twisting band down the playfield: same twist angle the notes use
  const segs = s.lite ? 18 : 36;
  for (let i = 0; i < segs; i++) {
    const p0 = i / segs;
    const p1 = (i + 1) / segs;
    const y0 = lerp(vy, hitY, Math.pow(p0, 1.3));
    const y1 = lerp(vy, hitY, Math.pow(p1, 1.3));
    const tw0 = Math.cos(p0 * Math.PI * 2 + t * 1.5);
    const tw1 = Math.cos(p1 * Math.PI * 2 + t * 1.5);
    const half0 = lerp(geom.stageW * 0.08, geom.stageW * 0.62, Math.pow(p0, 1.3)) * tw0;
    const half1 = lerp(geom.stageW * 0.08, geom.stageW * 0.62, Math.pow(p1, 1.3)) * tw1;
    const sway0 = Math.sin(p0 * Math.PI * 2 + t * 1.5) * geom.stageW * 0.16 * Math.sin(p0 * Math.PI);
    const sway1 = Math.sin(p1 * Math.PI * 2 + t * 1.5) * geom.stageW * 0.16 * Math.sin(p1 * Math.PI);
    const col = (tw0 + tw1) >= 0 ? front : back;
    ctx.fillStyle = colorWithAlpha(col, 0.05 + Math.abs(tw0) * 0.07);
    ctx.beginPath();
    ctx.moveTo(cx + sway0 - half0, y0);
    ctx.lineTo(cx + sway0 + half0, y0);
    ctx.lineTo(cx + sway1 + half1, y1);
    ctx.lineTo(cx + sway1 - half1, y1);
    ctx.closePath();
    ctx.fill();
    // Rim light on the band's edges, brightest where the band faces us
    ctx.strokeStyle = colorWithAlpha(col, 0.08 + Math.abs(tw0) * 0.22);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + sway0 - half0, y0);
    ctx.lineTo(cx + sway1 - half1, y1);
    ctx.moveTo(cx + sway0 + half0, y0);
    ctx.lineTo(cx + sway1 + half1, y1);
    ctx.stroke();
  }

  drawLaneGuides(s, 'mobius_loop', { fill: 0.14, edge: 0.5 });
}

/**
 * Draws the backdrop and lane guides for a POV that has a signature scene.
 * Call inside the 3D environment pass, before the hit targets and notes.
 */
// Outer edges of the three-lane deck, traced from the real lane paths, from p0 to p1.
function deckEdges(s: PovSceneInput, pov: PovMode, p0: number, p1: number, steps: number, pad: number) {
  const left: { x: number; y: number; w: number }[] = [];
  const right: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = lerp(p0, p1, i / steps);
    const a = proj(s, pov, 0, p);
    const b = proj(s, pov, LANE_COUNT - 1, p);
    left.push({ x: a.cx - a.w * (0.5 + pad), y: a.cy, w: a.w });
    right.push({ x: b.cx + b.w * (0.5 + pad), y: b.cy, w: b.w });
  }
  return { left, right };
}

/** p for a world marker every `spacing` seconds, so roadside props move at note speed. */
function markerPs(s: PovSceneInput, spacing: number, pMin: number, pMax: number): number[] {
  const out: number[] = [];
  const first = Math.floor((s.t - s.approachSec * (pMax - 1)) / spacing);
  for (let k = first; ; k++) {
    const p = 1 - (k * spacing - s.t) / s.approachSec;
    if (p < pMin) break;
    if (p <= pMax) out.push(p);
  }
  return out;
}

// ── CANYON RUN: desert road through red-rock S-bends at dusk ──
function drawCanyon(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const horizon = hitY * 0.30;
  const bend = canyonBend(t) * (s.stage === 5 ? 1.5 : 1);
  const drift = -bend * geom.stageW * 0.35;

  // Dusk sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, 'rgba(28,10,48,0.92)');
  sky.addColorStop(0.55, 'rgba(120,40,70,0.88)');
  sky.addColorStop(1, 'rgba(255,140,70,0.9)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 1);
  starfield(s, 41, s.lite ? 14 : 34, '255,220,200');

  // Setting sun, slid by the bend so the road visibly turns
  const sunX = W / 2 + drift * 0.6;
  const sunR = geom.stageW * 0.11;
  const halo = ctx.createRadialGradient(sunX, horizon, 0, sunX, horizon, sunR * 3.2);
  halo.addColorStop(0, `rgba(255,190,110,${0.45 + s.beat * 0.1})`);
  halo.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, horizon);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, horizon);
  ctx.clip();
  const sun = ctx.createLinearGradient(0, horizon - sunR, 0, horizon);
  sun.addColorStop(0, 'rgba(255,236,150,0.95)');
  sun.addColorStop(1, 'rgba(255,90,70,0.95)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, horizon, sunR, Math.PI, 0);
  ctx.fill();
  // Retro slats through the lower half of the sun
  ctx.fillStyle = 'rgba(120,40,70,0.9)';
  for (let k = 0; k < 4; k++) {
    const y = horizon - sunR * (0.12 + k * 0.13);
    ctx.fillRect(sunX - sunR, y, sunR * 2, 1.5 + k * 0.6);
  }
  ctx.restore();

  // Distant mesas, two parallax layers
  for (const [layer, col, hgt, par] of [[0, 'rgba(70,24,46,0.95)', 0.32, 0.35], [1, 'rgba(44,14,30,0.97)', 0.2, 0.7]] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 1);
    const span = W * 1.6;
    const off = (((drift * par) % span) + span) % span - span * 0.3;
    for (let k = 0; k < 9; k++) {
      const x0 = off + (k / 8) * span - span * 0.2;
      const w = span * (0.05 + hash(layer * 20 + k) * 0.07);
      const h = horizon * hgt * (0.4 + hash(layer * 20 + k * 1.7) * 0.6);
      ctx.lineTo(x0, horizon + 1);
      ctx.lineTo(x0 + w * 0.15, horizon - h);
      ctx.lineTo(x0 + w * 0.85, horizon - h);
      ctx.lineTo(x0 + w, horizon + 1);
    }
    ctx.lineTo(W, horizon + 1);
    ctx.closePath();
    ctx.fill();
  }

  // Desert floor
  const floor = ctx.createLinearGradient(0, horizon, 0, H);
  floor.addColorStop(0, 'rgba(120,52,40,0.95)');
  floor.addColorStop(1, 'rgba(48,18,20,0.97)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizon, W, H - horizon);

  const steps = s.lite ? 16 : 30;
  const pEnd = 1.3;
  const { left, right } = deckEdges(s, 'canyon_run', 0.0, pEnd, steps, 0.35);

  // Canyon walls rise from the shoulders; strata lines follow the bend
  const wallH = (i: number) => lerp(horizon * 0.45, H * 1.3, Math.pow(i / steps, 1.5));
  const wallOut = (i: number) => lerp(geom.stageW * 0.03, W * 0.16, Math.pow(i / steps, 1.5));
  for (const side of [-1, 1]) {
    const edge = side < 0 ? left : right;
    const wall = ctx.createLinearGradient(0, horizon - horizon * 0.3, 0, H);
    wall.addColorStop(0, side < 0 ? 'rgba(170,70,48,0.97)' : 'rgba(130,50,40,0.97)');
    wall.addColorStop(1, side < 0 ? 'rgba(90,30,28,0.98)' : 'rgba(70,22,24,0.98)');
    ctx.fillStyle = wall;
    ctx.beginPath();
    ctx.moveTo(edge[0].x, edge[0].y);
    for (let i = 1; i <= steps; i++) ctx.lineTo(edge[i].x, edge[i].y);
    for (let i = steps; i >= 0; i--) ctx.lineTo(edge[i].x + side * wallOut(i), edge[i].y - wallH(i));
    ctx.closePath();
    ctx.fill();
    // Strata
    ctx.lineWidth = 1;
    for (let f = 1; f <= 5; f++) {
      const u = f / 6;
      ctx.strokeStyle = `rgba(255,170,110,${0.07 + (f % 2) * 0.05})`;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = edge[i].x + side * wallOut(i) * u;
        const y = edge[i].y - wallH(i) * u;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Erosion grooves running up the cliff, passing at note speed
    ctx.strokeStyle = 'rgba(40,10,14,0.35)';
    for (const gp of markerPs(s, 0.27, 0.0, pEnd)) {
      const fi = Math.min(steps, Math.max(0, (gp / pEnd) * steps));
      const i0 = Math.min(steps - 1, Math.floor(fi));
      const u = fi - i0;
      const bx = lerp(edge[i0].x, edge[i0 + 1].x, u);
      const by = lerp(edge[i0].y, edge[i0 + 1].y, u);
      const ox = lerp(wallOut(i0), wallOut(i0 + 1), u);
      const oh = lerp(wallH(i0), wallH(i0 + 1), u);
      ctx.lineWidth = Math.max(1, lerp(edge[i0].w, edge[i0 + 1].w, u) * 0.05);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + side * ox, by - oh);
      ctx.stroke();
    }
    // Rim light along the wall top
    ctx.strokeStyle = 'rgba(255,200,130,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = edge[i].x + side * wallOut(i);
      const y = edge[i].y - wallH(i);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Road surface
  const road = ctx.createLinearGradient(0, horizon, 0, H);
  road.addColorStop(0, 'rgba(40,22,30,0.96)');
  road.addColorStop(1, 'rgba(18,10,16,0.97)');
  ctx.fillStyle = road;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i <= steps; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = steps; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
  // Shoulder lines
  ctx.strokeStyle = 'rgba(255,220,170,0.55)';
  ctx.lineWidth = 2;
  for (const edge of [left, right]) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      if (i === 0) ctx.moveTo(edge[i].x, edge[i].y); else ctx.lineTo(edge[i].x, edge[i].y);
    }
    ctx.stroke();
  }

  // Reflector posts on both shoulders, moving at note speed
  for (const p of markerPs(s, 0.4, 0.04, pEnd)) {
    for (const lane of [0, LANE_COUNT - 1]) {
      const a = proj(s, 'canyon_run', lane, p);
      const side = lane === 0 ? -1 : 1;
      const x = a.cx + side * a.w * 0.95;
      const ph = a.w * 0.35;
      const al = Math.min(1, p * 2.5);
      ctx.fillStyle = `rgba(230,220,210,${0.6 * al})`;
      ctx.fillRect(x - a.w * 0.025, a.cy - ph, a.w * 0.05, ph);
      ctx.fillStyle = lane === 0 ? `rgba(255,80,60,${0.9 * al})` : `rgba(255,190,60,${0.9 * al})`;
      ctx.fillRect(x - a.w * 0.03, a.cy - ph, a.w * 0.06, ph * 0.22);
    }
  }

  // Heat shimmer and dust motes drifting across the road
  if (!s.lite) {
    for (let k = 0; k < 26; k++) {
      const x = ((hash(k * 4.1) * W + t * (30 + hash(k) * 50) * (k % 2 ? 1 : -1)) % W + W) % W;
      const y = horizon + hash(k * 2.3) * (H - horizon);
      ctx.fillStyle = `rgba(255,200,150,${0.08 + 0.08 * Math.sin(t * 2 + k)})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  drawLaneGuides(s, 'canyon_run', { fill: 0.15, edge: 0.55, base: 0.28 });

  // Dust kicked up on hit
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const f = hitFlash(s, lane);
    if (f <= 0) continue;
    const a = proj(s, 'canyon_run', lane, 1);
    for (let k = 0; k < 7; k++) {
      const ang = Math.PI + (k / 6) * Math.PI;
      const r = a.w * (0.35 + (1 - f) * 0.9);
      ctx.fillStyle = `rgba(255,190,130,${f * 0.5})`;
      ctx.beginPath();
      ctx.arc(a.cx + Math.cos(ang) * r, a.cy + Math.sin(ang) * r * 0.35, 2 + (1 - f) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── AURORA BRIDGE: arched glass bridge over a frozen fjord under the northern lights ──
function drawAurora(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const horizon = hitY * 0.36;

  // Polar night sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, 'rgba(2,6,20,0.94)');
  sky.addColorStop(1, 'rgba(8,30,50,0.92)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 1);
  starfield(s, 77, s.lite ? 30 : 80, '210,240,255');

  // Aurora curtains: smooth ribbons with a bright lower hem and soft rays above it
  const bands = s.lite ? 2 : 3;
  const curtain = (mirror: boolean) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const N = s.lite ? 24 : 48;
    for (let b = 0; b < bands; b++) {
      const baseY = horizon * (0.42 + b * 0.14);
      const amp = horizon * (0.07 + b * 0.025);
      const hue = b === 1 ? '150,110,255' : '70,255,170';
      const rayH = horizon * (0.38 - b * 0.07) * (1 + s.energy * 0.3);
      const hemY = (x: number) => baseY + Math.sin(x * 0.006 + t * 0.35 + b * 2.1) * amp + Math.sin(x * 0.017 - t * 0.6 + b) * amp * 0.35;
      const topY = (x: number) => hemY(x) - rayH * (0.7 + 0.3 * Math.sin(x * 0.03 + t * 0.9 + b));
      const k = mirror ? -0.5 : 1;
      const yOf = (y: number) => (mirror ? 2 * horizon - y : y);
      const a = (0.22 + s.beat * 0.06) * (mirror ? 0.4 : 1);
      const g = ctx.createLinearGradient(0, yOf(baseY + amp), 0, yOf(baseY - amp - rayH * k));
      g.addColorStop(0, `rgba(${hue},0)`);
      g.addColorStop(0.12, `rgba(${hue},${a})`);
      g.addColorStop(0.4, `rgba(${hue},${a * 0.45})`);
      g.addColorStop(1, `rgba(${hue},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * W;
        const y = yOf(hemY(x) + amp * 0.15);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let i = N; i >= 0; i--) {
        const x = (i / N) * W;
        ctx.lineTo(x, yOf(hemY(x) + (topY(x) - hemY(x)) * (mirror ? 0.5 : 1)));
      }
      ctx.closePath();
      ctx.fill();
      if (!s.lite && !mirror) {
        // Faint rays rising out of the hem
        for (let r = 0; r < 18; r++) {
          const x = ((hash(b * 31 + r) * W + t * 8 * (b % 2 ? 1 : -1)) % W + W) % W;
          const y0 = hemY(x);
          const fl = 0.5 + 0.5 * Math.sin(t * 1.3 + r * 1.7 + b);
          const rg = ctx.createLinearGradient(0, y0, 0, y0 - rayH);
          rg.addColorStop(0, `rgba(${hue},${0.10 * fl})`);
          rg.addColorStop(1, `rgba(${hue},0)`);
          ctx.fillStyle = rg;
          ctx.fillRect(x - 2, y0 - rayH, 4 + hash(r) * 6, rayH);
        }
      }
    }
    ctx.restore();
  };
  curtain(false);

  // Snow-capped mountains on the far shore
  ctx.fillStyle = 'rgba(12,26,42,0.97)';
  ctx.beginPath();
  ctx.moveTo(0, horizon + 1);
  const peaks = 11;
  const pk: { x: number; y: number }[] = [];
  for (let k = 0; k <= peaks; k++) {
    const x = (k / peaks) * W;
    const y = horizon - horizon * (0.06 + hash(k * 3.3) * 0.22) * (k % 2 ? 1 : 0.45);
    pk.push({ x, y });
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, horizon + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(200,230,255,0.32)';
  for (let k = 1; k < peaks; k += 2) {
    const p = pk[k];
    const l = pk[k - 1];
    const r = pk[k + 1];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(lerp(p.x, l.x, 0.25), lerp(p.y, l.y, 0.25));
    ctx.lineTo(lerp(p.x, r.x, 0.25), lerp(p.y, r.y, 0.25));
    ctx.closePath();
    ctx.fill();
  }

  // Frozen fjord with the aurora mirrored in the ice
  const ice = ctx.createLinearGradient(0, horizon, 0, H);
  ice.addColorStop(0, 'rgba(14,40,60,0.95)');
  ice.addColorStop(1, 'rgba(4,10,20,0.97)');
  ctx.fillStyle = ice;
  ctx.fillRect(0, horizon, W, H - horizon);
  curtain(true);
  // Ice cracks
  ctx.strokeStyle = 'rgba(170,220,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < (s.lite ? 6 : 14); k++) {
    let x = hash(k * 5.7) * W;
    let y = lerp(horizon + 4, H, hash(k * 9.1));
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += (hash(k * 13 + j) - 0.5) * 80 * (y / H);
      y += (hash(k * 17 + j) - 0.3) * 18;
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  const steps = s.lite ? 16 : 30;
  const pEnd = 1.3;
  const { left, right } = deckEdges(s, 'aurora_bridge', 0.0, pEnd, steps, 0.3);

  // Deck underside and glass deck
  ctx.fillStyle = 'rgba(10,22,36,0.9)';
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i <= steps; i++) ctx.lineTo(left[i].x, left[i].y + left[i].w * 0.18);
  for (let i = steps; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y + right[i].w * 0.18);
  ctx.closePath();
  ctx.fill();
  const glass = ctx.createLinearGradient(0, horizon, 0, H);
  glass.addColorStop(0, 'rgba(60,120,160,0.25)');
  glass.addColorStop(1, 'rgba(20,50,80,0.55)');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i <= steps; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = steps; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();

  // Suspension towers and cables; towers arrive at note speed
  const towers = markerPs(s, 1.2, -0.6, 1.6);
  const tops: { l: { x: number; y: number }; r: { x: number; y: number }; d: { l: { x: number; y: number; w: number }; r: { x: number; y: number; w: number } } }[] = [];
  for (const p of towers) {
    const a = proj(s, 'aurora_bridge', 0, p);
    const b = proj(s, 'aurora_bridge', LANE_COUNT - 1, p);
    const lx = a.cx - a.w * 0.85;
    const rx = b.cx + b.w * 0.85;
    const th = Math.max(a.w, 4) * 1.9;
    tops.push({ l: { x: lx, y: a.cy - th }, r: { x: rx, y: b.cy - th }, d: { l: { x: lx, y: a.cy, w: a.w }, r: { x: rx, y: b.cy, w: b.w } } });
  }
  ctx.lineCap = 'round';
  // Main cables sag between towers, hangers drop to the deck
  for (let k = 0; k + 1 < tops.length; k++) {
    const A = tops[k];
    const B = tops[k + 1];
    for (const side of ['l', 'r'] as const) {
      const ta = A[side];
      const tb = B[side];
      const da = A.d[side];
      const db = B.d[side];
      const midX = (da.x + db.x) / 2;
      const midY = (da.y + db.y) / 2 - Math.max(da.w, db.w) * 0.3;
      ctx.strokeStyle = 'rgba(160,220,255,0.5)';
      ctx.lineWidth = Math.max(1, Math.max(da.w, db.w) * 0.03);
      ctx.beginPath();
      ctx.moveTo(ta.x, ta.y);
      ctx.quadraticCurveTo(midX, midY, tb.x, tb.y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(160,220,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let h = 1; h < 8; h++) {
        const u = h / 8;
        const cx = (1 - u) * (1 - u) * ta.x + 2 * u * (1 - u) * midX + u * u * tb.x;
        const cy = (1 - u) * (1 - u) * ta.y + 2 * u * (1 - u) * midY + u * u * tb.y;
        ctx.moveTo(cx, cy);
        ctx.lineTo(lerp(da.x, db.x, u), lerp(da.y, db.y, u));
      }
      ctx.stroke();
    }
  }
  // Tower legs with beacon lights
  for (const T of tops) {
    for (const side of ['l', 'r'] as const) {
      const top = T[side];
      const d = T.d[side];
      if (d.y < horizon - 2 || top.y > H) continue;
      ctx.strokeStyle = 'rgba(30,60,90,0.95)';
      ctx.lineWidth = Math.max(1.5, d.w * 0.09);
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      const blink = 0.5 + 0.5 * Math.sin(t * 3 + top.x * 0.01);
      const br = Math.min(6, Math.max(1.5, d.w * 0.05));
      const bg = ctx.createRadialGradient(top.x, top.y, 0, top.x, top.y, br * 3);
      bg.addColorStop(0, `rgba(255,80,90,${0.35 + blink * 0.45})`);
      bg.addColorStop(1, 'rgba(255,80,90,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(top.x, top.y, br * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.lineCap = 'butt';

  // Glowing deck rails
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const edge of [left, right]) {
    ctx.strokeStyle = 'rgba(120,255,210,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      if (i === 0) ctx.moveTo(edge[i].x, edge[i].y); else ctx.lineTo(edge[i].x, edge[i].y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Drifting snow
  if (!s.lite) {
    for (let k = 0; k < 40; k++) {
      const x = ((hash(k * 2.9) * W + Math.sin(t * 0.6 + k) * 20 - t * 12) % W + W) % W;
      const y = ((hash(k * 6.1) * H + t * (18 + hash(k) * 30)) % H);
      ctx.fillStyle = `rgba(230,245,255,${0.25 + hash(k * 1.3) * 0.35})`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }

  drawLaneGuides(s, 'aurora_bridge', { fill: 0.15, edge: 0.55, base: 0.3 });

  // Frost bloom on hit
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const f = hitFlash(s, lane);
    if (f <= 0) continue;
    const a = proj(s, 'aurora_bridge', lane, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(170,255,230,${f * 0.7})`;
    ctx.lineWidth = 1.5;
    const r = a.w * (0.4 + (1 - f) * 0.8);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2;
      ctx.moveTo(a.cx, a.cy);
      ctx.lineTo(a.cx + Math.cos(ang) * r, a.cy + Math.sin(ang) * r * 0.4);
    }
    ctx.stroke();
    ctx.restore();
  }
}

export function drawPovScene(pov: PovMode, s: PovSceneInput): void {
  const { ctx } = s;
  ctx.save();
  switch (pov) {
    case 'flat_2d': drawFlat2D(s); break;
    case 'canyon_run': drawCanyon(s); break;
    case 'aurora_bridge': drawAurora(s); break;
    case 'horizontal_drift': drawSideDrift(s); break;
    case 'cockpit_hud': drawCockpit(s); break;
    case 'hyper_prism': drawPrism(s); break;
    case 'dna_helix': drawDna(s); break;
    case 'vertigo_drop': drawVertigo(s); break;
    case 'singularity_void': drawSingularity(s); break;
    case 'ground_zero': drawGroundZero(s); break;
    case 'orbital_halo': drawHalo(s); break;
    case 'mobius_loop': drawMobius(s); break;
    default: break;
  }
  ctx.restore();
}

/**
 * Lane surfaces alone, for 3D POVs that keep the song archetype's environment
 * (tunnel, corkscrew, coaster, split): notes ride a visible lane instead of floating.
 */
export function drawPovLanes(pov: PovMode, s: PovSceneInput): void {
  const { ctx } = s;
  ctx.save();
  drawLaneGuides(s, pov, { fill: 0.09, edge: 0.4, base: 0.22, startP: 0.05 });
  ctx.restore();
}
