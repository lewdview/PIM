// ═══════════════════════════════════════════════════════════════
//  3D NOTE SLABS + BEATSTAR-STYLE HIT FEEDBACK
//  Notes are drawn as solid extruded tiles: a soft contact shadow on
//  the highway, a lane-tinted side wall that leans toward the screen
//  centre (the faces the camera can actually see), and a bevelled,
//  glossy top face. Hits pop the tile toward the camera, shoot a light
//  pillar up the lane and shatter into tumbling shards.
// ═══════════════════════════════════════════════════════════════

export type Note3DQuality = 'off' | 'low' | 'high';

let quality: Note3DQuality = 'high';

/** Set once per frame from the player's graphics options. */
export function setNote3DQuality(q: Note3DQuality) {
  quality = q;
}

export function getNote3DQuality(): Note3DQuality {
  return quality;
}

// Parsed colour cache: lane colours repeat every frame, so avoid re-parsing.
const rgbCache = new Map<string, [number, number, number]>();

export function parseRgb(color: string): [number, number, number] {
  const cached = rgbCache.get(color);
  if (cached) return cached;
  let out: [number, number, number] = [255, 255, 255];
  const c = (color || '').trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      out = [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)];
    } else if (hex.length >= 6) {
      out = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
  } else {
    const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) out = [+m[1], +m[2], +m[3]];
  }
  if (out.some((v) => !Number.isFinite(v))) out = [255, 255, 255];
  if (rgbCache.size > 64) rgbCache.clear();
  rgbCache.set(color, out);
  return out;
}

/** Multiply a colour toward black (k < 1) or toward white (k > 1). */
export function shade(color: string, k: number, alpha = 1): string {
  const [r, g, b] = parseRgb(color);
  const f = (v: number) =>
    Math.round(k <= 1 ? v * k : v + (255 - v) * Math.min(1, k - 1));
  return `rgba(${f(r)}, ${f(g)}, ${f(b)}, ${alpha})`;
}

/**
 * Screen-space extrusion vector for a note at the current transform origin.
 * The slab extends "down" toward the viewer and leans toward the screen
 * centre, so lanes left of centre show their right wall and vice versa.
 */
export function getSlabExtrusion(
  ctx: CanvasRenderingContext2D,
  noteW: number,
  noteH: number,
  prog: number
): { dx: number; dy: number; depth: number } {
  const p = Math.max(0, Math.min(1, prog));
  // Tiles read thicker as they approach the camera.
  const depth = Math.min(noteH * 0.34, Math.max(3, noteH * (0.14 + 0.16 * p)));
  let lateral = 0;
  try {
    const m = ctx.getTransform();
    const cw = ctx.canvas.width || 1;
    const sx = m.e; // origin is the note centre after translate()
    lateral = (cw / 2 - sx) / (cw / 2); // -1 (right edge) … +1 (left edge)
  } catch {
    lateral = 0;
  }
  lateral = Math.max(-1, Math.min(1, lateral));
  const dx = lateral * Math.min(noteW * 0.09, depth * 0.55);
  return { dx, dy: depth, depth };
}

/**
 * Draws the shadow + side walls of a tile. Call with the transform origin at
 * the note centre, before the top face is filled. `tracePath` must build the
 * top-face path centred on the origin (it is re-used for every layer).
 */
export function drawSlabBody(
  ctx: CanvasRenderingContext2D,
  tracePath: () => void,
  noteW: number,
  noteH: number,
  prog: number,
  wallColor: string,
  options: { isHold?: boolean } = {}
) {
  if (quality === 'off') return;
  const { dx, dy, depth } = getSlabExtrusion(ctx, noteW, noteH, prog);
  const p = Math.max(0, Math.min(1, prog));

  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 1. Contact shadow pooled on the highway under the slab.
  if (quality === 'high') {
    const sr = noteW * 0.62;
    const sy = dy + noteH * 0.42;
    ctx.save();
    ctx.translate(dx * 1.4, sy);
    ctx.scale(1, 0.28);
    const sg = ctx.createRadialGradient(0, 0, sr * 0.1, 0, 0, sr);
    sg.addColorStop(0, `rgba(0,0,0,${0.55 * (0.4 + 0.6 * p)})`);
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Side walls: stack the face outline from the bottom up so the swept
  //    volume keeps the rounded silhouette of the tile.
  const layers = quality === 'high' ? Math.max(3, Math.min(9, Math.round(depth / 2))) : 2;
  for (let i = layers; i >= 1; i--) {
    const k = i / layers;
    // Bottom of the wall is darkest; the lip just under the face catches light.
    const lum = options.isHold ? 0.55 - 0.3 * k : 0.62 - 0.42 * k;
    ctx.save();
    ctx.translate(dx * k, dy * k);
    tracePath();
    ctx.fillStyle = shade(wallColor, lum);
    ctx.fill();
    ctx.restore();
  }

  // 3. Rim light along the bottom of the wall (reads as a hard 3D edge).
  ctx.save();
  ctx.translate(dx, dy);
  tracePath();
  ctx.strokeStyle = shade(wallColor, 1.35, 0.45 + 0.35 * p);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/**
 * Bevel + gloss on the top face. Call after the face has been filled, with the
 * face path still current (it clips to it).
 */
export function drawTopFaceBevel(
  ctx: CanvasRenderingContext2D,
  noteW: number,
  noteH: number,
  rimColor: string
) {
  if (quality === 'off') return;
  ctx.save();
  ctx.clip();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Light falls from the top: bright upper bevel, darker lower bevel.
  const bevel = ctx.createLinearGradient(0, -noteH / 2, 0, noteH / 2);
  bevel.addColorStop(0, 'rgba(255,255,255,0.32)');
  bevel.addColorStop(0.16, 'rgba(255,255,255,0.06)');
  bevel.addColorStop(0.55, 'rgba(255,255,255,0)');
  bevel.addColorStop(0.86, 'rgba(0,0,0,0.12)');
  bevel.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = bevel;
  ctx.fillRect(-noteW / 2, -noteH / 2, noteW, noteH);

  if (quality === 'high') {
    // Thin inner rim tinted with the lane colour. Stroke it while the face
    // path is still current; the gloss below replaces the path.
    ctx.strokeStyle = shade(rimColor, 1.25, 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Specular gloss hotspot on the upper half (glass-tile look).
    ctx.save();
    ctx.translate(-noteW * 0.12, -noteH * 0.3);
    ctx.scale(1, 0.32);
    const gr = noteW * 0.5;
    const gloss = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
    gloss.addColorStop(0, 'rgba(255,255,255,0.28)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.beginPath();
    ctx.arc(0, 0, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ── HIT FEEDBACK ─────────────────────────────────────────────────

export interface HitShard {
  vx: number;
  vy: number;
  spin: number;
  rot0: number;
  w: number;
  h: number;
}

export function makeHitShards(kind: string, count: number): HitShard[] {
  const shards: HitShard[] = [];
  const n = kind === 'PERFECT+' ? count : kind === 'PERFECT' ? Math.ceil(count * 0.75) : Math.ceil(count * 0.5);
  for (let i = 0; i < n; i++) {
    // Fan upward and outward, like the tile bursting off the hit line.
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
    const sp = 260 + Math.random() * 340;
    shards.push({
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      spin: (Math.random() - 0.5) * 18,
      rot0: Math.random() * Math.PI,
      w: 6 + Math.random() * 12,
      h: 3 + Math.random() * 6,
    });
  }
  return shards;
}

export interface HitFx3D {
  cx: number;
  cy: number;
  color: string;
  kind: string;
  laneW?: number;
  shards?: HitShard[];
}

/** A point on a lane's centre line, from the hit target back toward the horizon. */
export interface LanePathPoint {
  x: number;
  y: number;
  w: number;
}

/**
 * Light pillar that shoots up the struck lane (PERFECT and up). It follows the
 * lane's projected path, so it stays inside its own lane in every POV, and it
 * must be drawn BEFORE the notes: additive light on top of the tiles washes
 * their dark faces out to grey.
 */
export function drawHitPillar3D(
  ctx: CanvasRenderingContext2D,
  e: HitFx3D,
  t01: number,
  path: LanePathPoint[]
) {
  if (quality === 'off' || path.length < 2) return;
  const isPerfect = e.kind === 'PERFECT+' || e.kind === 'PERFECT';
  if (!isPerfect || t01 >= 0.55) return;
  const strength = e.kind === 'PERFECT+' ? 1 : 0.8;
  const pt = t01 / 0.55;
  const a = (1 - pt) * 0.55 * strength;
  const widthK = lerp(0.92, 0.35, pt);

  const ribbon = (k: number) => {
    const left: LanePathPoint[] = [];
    const right: LanePathPoint[] = [];
    for (let i = 0; i < path.length; i++) {
      const prev = path[Math.max(0, i - 1)];
      const next = path[Math.min(path.length - 1, i + 1)];
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      const half = (path[i].w * k) / 2;
      const nx = (-ty / len) * half;
      const ny = (tx / len) * half;
      left.push({ x: path[i].x + nx, y: path[i].y + ny, w: 0 });
      right.push({ x: path[i].x - nx, y: path[i].y - ny, w: 0 });
    }
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
  };

  const p0 = path[0];
  const pN = path[path.length - 1];
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(p0.x, p0.y, pN.x, pN.y);
  g.addColorStop(0, shade(e.color, 1.5, a));
  g.addColorStop(0.35, shade(e.color, 1, a * 0.55));
  g.addColorStop(1, shade(e.color, 1, 0));
  ctx.fillStyle = g;
  ribbon(widthK);
  ctx.fill();
  // White hot core.
  const coreEnd = path[Math.max(1, Math.round((path.length - 1) * 0.7))];
  const cg = ctx.createLinearGradient(p0.x, p0.y, coreEnd.x, coreEnd.y);
  cg.addColorStop(0, `rgba(255,255,255,${a * 0.9})`);
  cg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = cg;
  ribbon(widthK * 0.24);
  ctx.fill();
  ctx.restore();
}

/** How far up the lane (in approach progress) the pillar reaches at time t01. */
export function hitPillarReach(t01: number): number {
  const pt = Math.min(1, t01 / 0.55);
  return lerp(0.8, 0.4, Math.min(1, pt * 2.2));
}

/**
 * Beatstar-style hit pop drawn on top of the existing ring/particle burst:
 *  - the tile itself flashes white and pops toward the camera,
 *  - a lens streak flares along the hit line,
 *  - shards of the tile tumble out with 3D shading.
 */
export function drawHitPop3D(
  ctx: CanvasRenderingContext2D,
  e: HitFx3D,
  t01: number,
  dt: number
) {
  if (quality === 'off') return;
  if (!Number.isFinite(e.cx) || !Number.isFinite(e.cy)) return;
  // A negative age (FX spawned later in the same frame) would make sqrt() NaN below.
  t01 = Math.max(0, t01);
  dt = Math.max(0, dt);
  const laneW = e.laneW && e.laneW > 0 ? e.laneW : 90;
  const strength = e.kind === 'PERFECT+' ? 1 : e.kind === 'PERFECT' ? 0.8 : e.kind === 'SHIELDED' ? 0.7 : 0.55;

  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'lighter';

  // 1. Horizontal lens streak along the hit line.
  if (t01 < 0.32) {
    const st = t01 / 0.32;
    const len = laneW * lerp(0.8, 2.6, Math.sqrt(st)) * strength;
    const a = (1 - st) * 0.85 * strength;
    const sg = ctx.createLinearGradient(e.cx - len, 0, e.cx + len, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, `rgba(255,255,255,${a})`);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    const th = lerp(6, 1.5, st);
    ctx.fillRect(e.cx - len, e.cy - th / 2, len * 2, th);
  }
  ctx.restore();

  // 2. Tile pop: the struck note flashes white and lifts off toward the camera.
  if (t01 < 0.42 && e.kind !== 'SHIELDED') {
    const pt = t01 / 0.42;
    const ease = 1 - Math.pow(1 - pt, 3);
    const scale = lerp(1.0, 1.32, ease);
    const w = laneW * 0.86 * scale;
    const h = Math.max(30, laneW * 0.62) * scale;
    const lift = ease * h * 0.35;
    const a = Math.pow(1 - pt, 1.5) * strength;
    ctx.save();
    ctx.translate(e.cx, e.cy - lift);
    ctx.globalAlpha = a;
    const r = Math.min(18, h * 0.22);
    const depth = h * 0.22;
    // Wall (pops with the tile so it stays a solid block).
    ctx.fillStyle = shade(e.color, 0.55);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2 + depth, w, h, r);
    ctx.fill();
    // Face: white-hot centre bleeding to the lane colour.
    const fg = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    fg.addColorStop(0, 'rgba(255,255,255,1)');
    fg.addColorStop(0.55, shade(e.color, 1.6));
    fg.addColorStop(1, shade(e.color, 1.0));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, r);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.restore();
  }

  // 3. Tumbling 3D shards.
  if (e.shards && e.shards.length && t01 < 0.95) {
    const life = Math.max(0, 1 - t01 / 0.95);
    for (const s of e.shards) {
      const px = e.cx + s.vx * dt;
      const py = e.cy + s.vy * dt + 900 * dt * dt;
      const rot = s.rot0 + s.spin * dt;
      // Fake a flip around the shard's own axis: squash height by cos(rot).
      const flip = Math.cos(rot * 1.3);
      const hw = s.w * (0.6 + 0.4 * life);
      const hh = s.h * Math.abs(flip) + 0.8;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.globalAlpha = life;
      // Thickness edge.
      ctx.fillStyle = shade(e.color, 0.45);
      ctx.fillRect(-hw / 2, -hh / 2 + 1.6, hw, hh);
      // Lit face: brighter while facing the camera.
      ctx.fillStyle = flip > 0 ? shade(e.color, 1.45) : shade(e.color, 0.9);
      ctx.fillRect(-hw / 2, -hh / 2, hw, hh);
      ctx.restore();
    }
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
