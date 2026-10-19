// ═══════════════════════════════════════════════════════════════
//  NOTE CELEBRATIONS
//  Special notes get their own payoff on top of the normal hit pop:
//  a BREAK (drop) fires a confetti cannon, an ACCENT (beat) throws
//  curling pink ribbons. Now and then either one swaps for an oddity
//  — floating hearts, popping bubbles or spinning stars — so the
//  drops never feel the same twice.
// ═══════════════════════════════════════════════════════════════

export type CelebrationKind = 'confetti' | 'ribbons' | 'hearts' | 'bubbles' | 'stars';
export type CelebrationNote = 'break' | 'accent';

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  phase: number;
  vPhase: number;
  trail?: { x: number; y: number }[];
}

export interface Celebration {
  kind: CelebrationKind;
  startMs: number;
  lastMs: number;
  lifeMs: number;
  originX: number;
  originY: number;
  bits: Bit[];
}

const MAX_ACTIVE = 6;
/** Chance that a hit swaps its signature effect for an oddity. */
const ODDITY_CHANCE = 0.2;
const ODDITIES: CelebrationKind[] = ['hearts', 'bubbles', 'stars'];

const LIFE_MS: Record<CelebrationKind, number> = {
  confetti: 1900,
  ribbons: 1500,
  hearts: 1800,
  bubbles: 1800,
  stars: 1200,
};

const CONFETTI_COLORS = ['#FF3B6B', '#FFD23F', '#3BCEAC', '#00B4FF', '#B967FF', '#FF7B00', '#FFFFFF', '#CCFF00'];
const RIBBON_COLORS = ['#FF4FD8', '#FF8AD8', '#FF1F8F', '#FFB3E6', '#FF5CA8'];
const HEART_COLORS = ['#FF2E63', '#FF6B9A', '#FF9EC4', '#E0115F'];
const STAR_COLORS = ['#FFD700', '#FFF6B0', '#FFFFFF', '#FFB300'];

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

/** The effect a hit on this note type plays. */
export function chooseCelebration(note: CelebrationNote, rand: () => number = Math.random): CelebrationKind {
  if (rand() < ODDITY_CHANCE) return pick(ODDITIES, rand);
  return note === 'break' ? 'confetti' : 'ribbons';
}

/**
 * Start a celebration at (x, y). `density` scales the particle count
 * (1 = full, 0.5 = half) so it follows the player's particle setting.
 */
export function spawnCelebration(
  list: Celebration[],
  note: CelebrationNote,
  x: number,
  y: number,
  nowMs: number,
  density = 1,
  rand: () => number = Math.random,
  kind: CelebrationKind = chooseCelebration(note, rand),
): CelebrationKind {
  const bits: Bit[] = [];
  const n = (full: number) => Math.max(4, Math.round(full * density));
  const bit = (b: Partial<Bit> & Pick<Bit, 'vx' | 'vy' | 'size' | 'color'>): Bit => ({
    x,
    y,
    rot: rand() * Math.PI * 2,
    vr: 0,
    phase: rand() * Math.PI * 2,
    vPhase: 0,
    ...b,
  });

  if (kind === 'confetti') {
    for (let i = 0, c = n(70); i < c; i++) {
      const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 0.95;
      const speed = 450 + rand() * 650;
      bits.push(bit({
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vr: (rand() - 0.5) * 24,
        vPhase: 8 + rand() * 10,
        size: 5 + rand() * 6,
        color: pick(CONFETTI_COLORS, rand),
      }));
    }
  } else if (kind === 'ribbons') {
    for (let i = 0, c = n(7); i < c; i++) {
      const angle = -Math.PI / 2 + ((i + 0.5) / c - 0.5) * Math.PI * 1.1 + (rand() - 0.5) * 0.25;
      const speed = 420 + rand() * 260;
      bits.push(bit({
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vPhase: 10 + rand() * 6,
        size: 5 + rand() * 3,
        color: pick(RIBBON_COLORS, rand),
        trail: [],
      }));
    }
  } else if (kind === 'hearts') {
    for (let i = 0, c = n(14); i < c; i++) {
      bits.push(bit({
        vx: (rand() - 0.5) * 260,
        vy: -140 - rand() * 220,
        vPhase: 3 + rand() * 3,
        size: 9 + rand() * 10,
        color: pick(HEART_COLORS, rand),
      }));
    }
  } else if (kind === 'bubbles') {
    for (let i = 0, c = n(16); i < c; i++) {
      bits.push(bit({
        vx: (rand() - 0.5) * 220,
        vy: -90 - rand() * 200,
        vPhase: 2 + rand() * 3,
        size: 7 + rand() * 15,
        color: '#FFFFFF',
      }));
    }
  } else {
    for (let i = 0, c = n(18); i < c; i++) {
      const angle = (i / c) * Math.PI * 2 + (rand() - 0.5) * 0.4;
      const speed = 260 + rand() * 360;
      bits.push(bit({
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        vr: (rand() - 0.5) * 14,
        vPhase: 4 + rand() * 4,
        size: 6 + rand() * 7,
        color: pick(STAR_COLORS, rand),
      }));
    }
  }

  if (list.length >= MAX_ACTIVE) list.shift();
  list.push({ kind, startMs: nowMs, lastMs: nowMs, lifeMs: LIFE_MS[kind], originX: x, originY: y, bits });
  return kind;
}

function step(c: Celebration, dt: number) {
  for (const b of c.bits) {
    b.phase += b.vPhase * dt;
    b.rot += b.vr * dt;
    if (c.kind === 'confetti') {
      const drag = Math.pow(0.3, dt);
      b.vx *= drag;
      b.vy = b.vy * drag + 1100 * dt;
      b.vx += Math.sin(b.phase * 0.5) * 40 * dt; // flutter
    } else if (c.kind === 'ribbons') {
      const drag = Math.pow(0.45, dt);
      b.vx *= drag;
      b.vy = b.vy * drag + 520 * dt;
    } else if (c.kind === 'hearts' || c.kind === 'bubbles') {
      const drag = Math.pow(0.6, dt);
      b.vx = b.vx * drag + Math.sin(b.phase) * 90 * dt;
      b.vy = b.vy * drag - 30 * dt; // keep rising
    } else {
      const drag = Math.pow(0.25, dt);
      b.vx *= drag;
      b.vy = b.vy * drag + 380 * dt;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.trail) {
      // Ribbons curl: offset each recorded point sideways along a sine
      const len = Math.hypot(b.vx, b.vy) || 1;
      const wiggle = Math.sin(b.phase) * 9;
      b.trail.push({ x: b.x + (-b.vy / len) * wiggle, y: b.y + (b.vx / len) * wiggle });
      if (b.trail.length > 22) b.trail.shift();
    }
  }
}

function heartPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.45, -s * 1.05, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.45, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.35);
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? s : s * 0.42;
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Advance and draw every live celebration, dropping finished ones. */
export function drawCelebrations(ctx: CanvasRenderingContext2D, list: Celebration[], nowMs: number) {
  let write = 0;
  for (let i = 0; i < list.length; i++) {
    if (nowMs - list[i].startMs < list[i].lifeMs) list[write++] = list[i];
  }
  list.length = write;

  for (const c of list) {
    // Clamp the step so a backgrounded tab doesn't fling everything off screen
    const dt = Math.min(0.05, Math.max(0, (nowMs - c.lastMs) / 1000));
    c.lastMs = nowMs;
    if (dt > 0) step(c, dt);

    const t01 = Math.max(0, (nowMs - c.startMs) / c.lifeMs);
    const fade = t01 < 0.7 ? 1 : Math.max(0, 1 - (t01 - 0.7) / 0.3);

    ctx.save();

    if (c.kind === 'confetti' && t01 < 0.25) {
      // Cannon flash at the strike point
      const r = 30 + t01 * 520;
      ctx.globalAlpha = (1 - t01 / 0.25) * 0.7;
      ctx.strokeStyle = '#FFD23F';
      ctx.lineWidth = 6 * (1 - t01 / 0.25) + 1;
      ctx.beginPath();
      ctx.arc(c.originX, c.originY, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const b of c.bits) {
      ctx.globalAlpha = fade;
      if (c.kind === 'confetti') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.scale(1, Math.cos(b.phase)); // tumbling flip
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
        ctx.restore();
      } else if (c.kind === 'ribbons' && b.trail && b.trail.length > 1) {
        ctx.strokeStyle = b.color;
        ctx.lineCap = 'round';
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        const tr = b.trail;
        for (let k = 1; k < tr.length; k++) {
          ctx.lineWidth = (b.size * k) / tr.length;
          ctx.beginPath();
          ctx.moveTo(tr[k - 1].x, tr[k - 1].y);
          ctx.lineTo(tr[k].x, tr[k].y);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      } else if (c.kind === 'hearts') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.sin(b.phase) * 0.35);
        const pulse = 1 + Math.sin(b.phase * 2) * 0.08;
        ctx.scale(pulse, pulse);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        heartPath(ctx, b.size);
        ctx.fill();
        ctx.restore();
      } else if (c.kind === 'bubbles') {
        const popAt = 0.6 + (b.size / 22) * 0.35; // bigger bubbles last longer
        if (t01 < popAt) {
          const g = ctx.createRadialGradient(b.x - b.size * 0.35, b.y - b.size * 0.35, b.size * 0.1, b.x, b.y, b.size);
          g.addColorStop(0, 'rgba(255,255,255,0.85)');
          g.addColorStop(0.5, 'rgba(160,220,255,0.15)');
          g.addColorStop(0.85, 'rgba(255,140,230,0.35)');
          g.addColorStop(1, 'rgba(120,255,220,0.6)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (t01 < popAt + 0.08) {
          // Pop: a quick spray ring
          const p = (t01 - popAt) / 0.08;
          ctx.globalAlpha = (1 - p) * fade;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            const r0 = b.size * (1 + p * 0.6);
            const r1 = r0 + 5;
            ctx.beginPath();
            ctx.moveTo(b.x + Math.cos(a) * r0, b.y + Math.sin(a) * r0);
            ctx.lineTo(b.x + Math.cos(a) * r1, b.y + Math.sin(a) * r1);
            ctx.stroke();
          }
        }
      } else if (c.kind === 'stars') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 12;
        starPath(ctx, b.size * (0.85 + Math.sin(b.phase * 4) * 0.15));
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }
}
