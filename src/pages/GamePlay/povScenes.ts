// PIM : per-POV signature scenes
//
// Each POV camera gets its own backdrop, palette and hit reaction so switching
// cameras changes the whole look, not just the note path. Lane guides are traced
// from getArchetypeProjection itself, so they always sit exactly under the notes.
// Rendering only: nothing here touches timing, input or judging.

import type { PovMode } from '@/lib/options';
import type { TrackArchetype } from './archetypes';
import { getArchetypeProjection } from './projections';
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
  'circle',
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

/** False for POVs whose strike targets orbit or stack, so a horizontal baseline would mislead. */
export function hasStraightHitLine(pov: PovMode): boolean {
  return pov !== 'circle' && pov !== 'horizontal_drift';
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

/**
 * Translucent lane ribbons traced along the real note path, brightening when the
 * lane is pressed or just scored a hit.
 */
function drawLaneGuides(s: PovSceneInput, pov: PovMode, opts: { fill: number; edge: number; startP?: number }) {
  const { ctx } = s;
  const steps = s.lite ? 14 : 26;
  const p0 = opts.startP ?? 0.02;
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const col = s.laneColors[lane] || '#00E5FF';
    const flash = hitFlash(s, lane);
    const press = s.pressed[lane] ? 1 : 0;
    const pts: { x: number; y: number; half: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const p = lerp(p0, 1, i / steps);
      const a = proj(s, pov, lane, p);
      pts.push({ x: a.cx, y: a.cy, half: 0 });
    }
    // Cross-size follows the travel direction: note width when moving vertically, note height when moving sideways.
    for (let i = 0; i <= steps; i++) {
      const p = lerp(p0, 1, i / steps);
      const a = proj(s, pov, lane, p);
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(steps, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      pts[i].half = (Math.abs(dy) >= Math.abs(dx) ? a.w : a.h * 0.9) * 0.46;
    }
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(steps, i + 1)];
      let nx = -(next.y - prev.y);
      let ny = next.x - prev.x;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      left.push({ x: pts[i].x + nx * pts[i].half, y: pts[i].y + ny * pts[i].half });
      right.push({ x: pts[i].x - nx * pts[i].half, y: pts[i].y - ny * pts[i].half });
    }

    const head = pts[0];
    const tail = pts[steps];
    const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    const boost = Math.max(flash * 0.9, press * 0.35);
    grad.addColorStop(0, colorWithAlpha(col, 0));
    grad.addColorStop(0.55, colorWithAlpha(col, opts.fill * 0.6 + boost * 0.12));
    grad.addColorStop(1, colorWithAlpha(col, Math.min(0.9, opts.fill + boost * 0.4)));

    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i <= steps; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = steps; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    const edgeGrad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    edgeGrad.addColorStop(0, colorWithAlpha(col, 0));
    edgeGrad.addColorStop(1, colorWithAlpha(col, Math.min(1, opts.edge + boost * 0.5)));
    ctx.strokeStyle = edgeGrad;
    ctx.lineWidth = 1.4 + boost * 2;
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i <= steps; i++) ctx.lineTo(left[i].x, left[i].y);
    ctx.moveTo(right[0].x, right[0].y);
    for (let i = 1; i <= steps; i++) ctx.lineTo(right[i].x, right[i].y);
    ctx.stroke();
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

// ── 360° ORBIT: radar dish with the judgment ring the notes actually converge on ──
function drawCircle(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const geom = getStageGeometry(W, H);
  const cx = W / 2;
  const cy = H * 0.5;
  const maxR = Math.min(geom.stageW, H) * 0.44;
  const hitR = Math.min(geom.stageW, H) * 0.16;

  const neb = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 1.6);
  neb.addColorStop(0, 'rgba(10,40,70,0.55)');
  neb.addColorStop(0.5, 'rgba(8,16,40,0.45)');
  neb.addColorStop(1, 'rgba(2,4,12,0)');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, W, H);
  starfield(s, 11, s.lite ? 30 : 70, '170,230,255');

  // Range rings
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const r = lerp(hitR, maxR, i / 4);
    ctx.strokeStyle = `rgba(120,220,255,${0.08 + (i === 4 ? 0.08 : 0)})`;
    ctx.setLineDash(i === 4 ? [6, 8] : []);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Radar sweep
  const sweep = t * 1.4;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sweep);
  const sg = ctx.createLinearGradient(0, 0, maxR, 0);
  sg.addColorStop(0, 'rgba(0,229,255,0.0)');
  sg.addColorStop(1, 'rgba(0,229,255,0.16)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, maxR, -0.45, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Judgment ring
  const flash = anyHitFlash(s);
  ctx.strokeStyle = `rgba(255,255,255,${0.30 + s.beat * 0.2 + flash * 0.4})`;
  ctx.lineWidth = 2 + flash * 3;
  ctx.beginPath();
  ctx.arc(cx, cy, hitR + s.beat * 3, 0, Math.PI * 2);
  ctx.stroke();

  // Core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, hitR * 0.6);
  core.addColorStop(0, `rgba(255,255,255,${0.35 + s.beat * 0.3})`);
  core.addColorStop(0.4, 'rgba(0,229,255,0.18)');
  core.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, hitR * 0.6, 0, Math.PI * 2);
  ctx.fill();

  drawLaneGuides(s, 'circle', { fill: 0.16, edge: 0.45 });
}

// ── SIDE DRIFT: synthwave side-scroller with parallax ridges ──
function drawSideDrift(s: PovSceneInput) {
  const { ctx, W, H, t } = s;
  const trackH = Math.min(H * 0.55, 360);
  const startY = (H - trackH) / 2;

  fillBackdrop(ctx, W, H, [[0, 'rgba(20,4,40,0.75)'], [0.55, 'rgba(60,10,70,0.55)'], [1, 'rgba(10,2,20,0.85)']]);

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
  ctx.strokeStyle = `rgba(255,255,255,${0.7 + flash * 0.3})`;
  ctx.lineWidth = 1.6;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.moveTo(0, -ps);
  ctx.lineTo(ps * 0.9, ps * 0.6);
  ctx.lineTo(-ps * 0.9, ps * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
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
    for (let y = -((scroll) % 22); y < H; y += 22) {
      const ph = ((y + scroll) / pitch) * Math.PI * 2 + phase0;
      const x1 = tx + Math.sin(ph) * amp;
      const x2 = tx - Math.sin(ph) * amp;
      const depth = Math.cos(ph);
      ctx.strokeStyle = `rgba(200,240,255,${0.06 + Math.abs(depth) * 0.08})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }
    for (let strand = 0; strand < 2; strand++) {
      ctx.strokeStyle = colorWithAlpha(strand ? colB : colA, 0.55);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = -10; y <= H + 10; y += 8) {
        const ph = ((y + scroll) / pitch) * Math.PI * 2 + phase0;
        const x = tx + (strand ? -1 : 1) * Math.sin(ph) * amp;
        if (y === -10) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  drawLaneGuides(s, 'dna_helix', { fill: 0.13, edge: 0.45 });

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
    const winW = Math.max(1.5, hw * 0.05);
    const rows = 5;
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
  const R = geom.stageW * 0.07;

  fillBackdrop(ctx, W, H, [[0, 'rgba(2,1,6,0.9)'], [1, 'rgba(6,2,10,0.88)']]);
  starfield(s, 41, s.lite ? 30 : 80, '255,236,210');

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
  ctx.restore();

  // Ring body
  ctx.strokeStyle = 'rgba(150,170,200,0.35)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
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
  }

  drawLaneGuides(s, 'mobius_loop', { fill: 0.14, edge: 0.5 });
}

/**
 * Draws the backdrop and lane guides for a POV that has a signature scene.
 * Call inside the 3D environment pass, before the hit targets and notes.
 */
export function drawPovScene(pov: PovMode, s: PovSceneInput): void {
  const { ctx } = s;
  ctx.save();
  switch (pov) {
    case 'flat_2d': drawFlat2D(s); break;
    case 'circle': drawCircle(s); break;
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
