/**
 * Secret level: SIGNAL SIEGE — a Galaga-style shooter on the beat.
 *
 * The ship slides across the game's 3 lanes. Enemy waves drop in on the
 * beat; shoot each one before it reaches the bottom. A shot fired on the
 * beat is a double-damage laser worth double points.
 */

import { offBeat, seeded, type SecretGame, type SecretInput } from './types';

type EnemyKind = 'drone' | 'swoop' | 'boss';

interface Enemy {
  kind: EnemyKind;
  spawn: number;   // beat it appears at the top
  travel: number;  // beats to reach the ship row
  l0: number;
  l1: number;      // swoopers change lane mid-flight
  hp: number;
  maxHp: number;
  dead: boolean;
  gone: boolean;   // reached the bottom
  deadAt: number;
}

interface Bullet { lane: number; y: number; big: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }

const SHIP_Y = 0.86;
const TOP_Y = -0.06;
const ON_BEAT = 0.12;
const FIRE_COOLDOWN = 0.22;

const laneX = (lane: number, w: number) => w * (0.22 + 0.28 * lane);
const smooth = (t: number) => t * t * (3 - 2 * t);

export class ShooterLevel implements SecretGame {
  readonly title = 'SIGNAL SIEGE';
  readonly hint = '← → or tap a lane to move · SPACE or tap to fire · shoot on the beat for a laser';
  readonly totalBeats = 72;
  score = 0;
  lives = 5;
  done = false;
  won = false;

  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private sparks: Spark[] = [];
  private stars: { x: number; y: number; s: number }[] = [];
  private lane = 1;
  private shipX = -1;
  private combo = 0;
  private lastFire = -99;
  private hurtUntil = 0;
  private popups: { text: string; x: number; y: number; at: number }[] = [];

  constructor() {
    const rand = seeded(1337);
    const add = (kind: EnemyKind, spawn: number, l0: number, l1 = l0) => {
      const hp = kind === 'boss' ? 8 : kind === 'swoop' ? 2 : 1;
      this.enemies.push({
        kind, spawn, l0, l1, hp, maxHp: hp,
        travel: kind === 'boss' ? 10 : kind === 'swoop' ? 5 : 4,
        dead: false, gone: false, deadAt: 0,
      });
    };
    const lane = () => Math.floor(rand() * 3);
    for (let b = 4; b < 20; b += 2) add('drone', b, (b / 2) % 3);
    for (let b = 20; b < 36; b++) add('drone', b, lane());
    for (let b = 36; b < 52; b += 2) {
      const a = lane();
      add('swoop', b, a, (a + 1 + Math.floor(rand() * 2)) % 3);
      add('drone', b + 1, lane());
    }
    for (let b = 52; b < 60; b += 2) {
      const a = lane();
      add('drone', b, a);
      add('drone', b, (a + 1 + Math.floor(rand() * 2)) % 3);
    }
    add('boss', 60, 1);
    for (let i = 0; i < 70; i++) this.stars.push({ x: rand(), y: rand(), s: 0.3 + rand() * 1.4 });
  }

  private enemyPos(e: Enemy, beat: number) {
    const p = (beat - e.spawn) / e.travel;
    let lane = e.l0;
    if (e.kind === 'swoop') lane = e.l0 + (e.l1 - e.l0) * smooth(Math.max(0, Math.min(1, (p - 0.25) / 0.35)));
    if (e.kind === 'boss') lane = 1 + Math.sin(beat * Math.PI * 0.5);
    return { p, lane, y: TOP_Y + (SHIP_Y - TOP_Y) * p };
  }

  input(a: SecretInput, beat: number) {
    if (this.done) return;
    if (a.kind === 'left') this.lane = Math.max(0, this.lane - 1);
    else if (a.kind === 'right') this.lane = Math.min(2, this.lane + 1);
    else if (a.kind === 'fire' || a.kind === 'jump') this.fire(beat);
    else if (a.kind === 'pointer') {
      this.lane = Math.max(0, Math.min(2, Math.floor((a.x / a.w) * 3)));
      this.fire(beat);
    }
  }

  private fire(beat: number) {
    if (beat - this.lastFire < FIRE_COOLDOWN) return;
    this.lastFire = beat;
    this.bullets.push({ lane: this.lane, y: SHIP_Y - 0.04, big: offBeat(beat) < ON_BEAT });
  }

  update(beat: number, dt: number) {
    if (this.done) return;
    for (const b of this.bullets) b.y -= dt * 2.4;
    this.bullets = this.bullets.filter((b) => b.y > -0.1);

    for (const e of this.enemies) {
      if (e.dead || e.gone || beat < e.spawn) continue;
      const pos = this.enemyPos(e, beat);
      for (const b of this.bullets) {
        if (b.y < -1) continue;
        const hitW = e.kind === 'boss' ? 0.9 : 0.5;
        if (Math.abs(b.lane - pos.lane) < hitW && Math.abs(b.y - pos.y) < (e.kind === 'boss' ? 0.07 : 0.045)) {
          e.hp -= b.big ? 2 : 1;
          b.y = -2; // spent
          this.burst(pos.lane, pos.y, e.hp <= 0 ? 18 : 5, b.big ? '#FFFFFF' : '#FFD23F');
          if (e.hp <= 0) {
            e.dead = true;
            e.deadAt = beat;
            this.combo++;
            const base = e.kind === 'boss' ? 2000 : e.kind === 'swoop' ? 250 : 100;
            const pts = base * (b.big ? 2 : 1) * (1 + Math.floor(this.combo / 8));
            this.score += pts;
            this.popups.push({ text: b.big ? `ON BEAT +${pts}` : `+${pts}`, x: pos.lane, y: pos.y, at: beat });
          }
        }
      }
      if (!e.dead && pos.p >= 1) {
        e.gone = true;
        this.combo = 0;
        this.lives -= e.kind === 'boss' ? 2 : 1;
        this.hurtUntil = beat + 1;
        this.burst(pos.lane, SHIP_Y, 14, '#FF3B6B');
      }
    }

    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 0.6 * dt;
      s.life -= dt * 1.6;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    this.popups = this.popups.filter((p) => beat - p.at < 1.5);

    if (this.lives <= 0) {
      this.lives = 0;
      this.done = true;
    } else if (beat >= this.totalBeats) {
      this.done = true;
      this.won = true;
      this.score += this.lives * 500;
    }
  }

  private burst(lane: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.1 + Math.random() * 0.5;
      this.sparks.push({ x: lane, y, vx: Math.cos(a) * sp * 1.5, vy: Math.sin(a) * sp, life: 1, color });
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, beat: number) {
    const pulse = 1 - (((beat % 1) + 1) % 1);
    ctx.fillStyle = '#05010F';
    ctx.fillRect(0, 0, w, h);

    // Starfield, faster as the level goes on
    const speed = 0.04 + 0.002 * Math.max(0, beat);
    for (const s of this.stars) {
      const y = (((s.y + beat * speed * s.s) % 1) + 1) % 1;
      ctx.fillStyle = `rgba(200,220,255,${0.3 + 0.5 * s.s / 1.7})`;
      ctx.fillRect(s.x * w, y * h, s.s, s.s * (1 + speed * 20));
    }

    // Lane rails, glowing on the beat
    for (let l = 0; l < 3; l++) {
      ctx.strokeStyle = `rgba(185,103,255,${0.12 + 0.25 * pulse * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(laneX(l, w), 0);
      ctx.lineTo(laneX(l, w), h);
      ctx.stroke();
    }

    for (const e of this.enemies) {
      if (beat < e.spawn || e.gone) continue;
      if (e.dead) continue;
      const pos = this.enemyPos(e, beat);
      const x = laneX(0, w) + (laneX(1, w) - laneX(0, w)) * pos.lane;
      this.drawEnemy(ctx, e, x, pos.y * h, w, beat);
    }

    for (const b of this.bullets) {
      if (b.y < -1) continue;
      const x = laneX(b.lane, w);
      if (b.big) {
        ctx.strokeStyle = `hsl(${(beat * 200) % 360},100%,70%)`;
        ctx.lineWidth = 7;
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 14;
      } else {
        ctx.strokeStyle = '#FFE36E';
        ctx.lineWidth = 3;
      }
      ctx.beginPath();
      ctx.moveTo(x, b.y * h);
      ctx.lineTo(x, b.y * h + (b.big ? 34 : 18));
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    for (const s of this.sparks) {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.color;
      const x = laneX(0, w) + (laneX(1, w) - laneX(0, w)) * s.x;
      ctx.fillRect(x - 2, s.y * h - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // Ship
    const target = laneX(this.lane, w);
    this.shipX = this.shipX < 0 ? target : this.shipX + (target - this.shipX) * 0.35;
    const flicker = beat < this.hurtUntil && Math.floor(beat * 8) % 2 === 0;
    if (!flicker) this.drawShip(ctx, this.shipX, SHIP_Y * h, pulse);

    ctx.font = '900 16px "Space Mono", monospace';
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      ctx.globalAlpha = 1 - (beat - p.at) / 1.5;
      ctx.fillStyle = p.text.startsWith('ON BEAT') ? '#7CFFCB' : '#FFFFFF';
      const x = laneX(0, w) + (laneX(1, w) - laneX(0, w)) * p.x;
      ctx.fillText(p.text, x, p.y * h - 20 - (beat - p.at) * 20);
    }
    ctx.globalAlpha = 1;
  }

  private drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = `rgba(255,140,0,${0.5 + 0.5 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(-6, 16);
    ctx.lineTo(0, 30 + 10 * pulse);
    ctx.lineTo(6, 16);
    ctx.fill();
    ctx.fillStyle = '#00E5FF';
    ctx.shadowColor = '#00E5FF';
    ctx.shadowBlur = 14;
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

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, w: number, beat: number) {
    ctx.save();
    ctx.translate(x, y);
    const flap = Math.sin(beat * Math.PI * 2) * 0.35;
    if (e.kind === 'boss') {
      const r = Math.min(70, w * 0.12);
      ctx.fillStyle = '#B91C1C';
      ctx.shadowColor = '#FF3B6B';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFD23F';
      for (const ex of [-r * 0.35, r * 0.35]) {
        ctx.beginPath();
        ctx.arc(ex, -4, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(-r, -r * 0.8, r * 2, 6);
      ctx.fillStyle = '#7CFFCB';
      ctx.fillRect(-r, -r * 0.8, (r * 2 * e.hp) / e.maxHp, 6);
    } else {
      const color = e.kind === 'swoop' ? '#FFD23F' : '#FF4FD8';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(side, 1);
        ctx.rotate(flap);
        ctx.beginPath();
        ctx.ellipse(12, 0, 12, 6, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#05010F';
      ctx.fillRect(-5, -2, 3, 3);
      ctx.fillRect(2, -2, 3, 3);
    }
    ctx.restore();
  }
}
