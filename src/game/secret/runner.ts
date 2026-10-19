/**
 * Secret level: ROOFTOP RUN — a beat platformer.
 *
 * The runner moves at one beat per step. Spikes and pits arrive half a
 * beat after a beat, so jumping on the beat clears them; laser bars come
 * at head height and are ducked. Later sections add raised platforms over
 * spike beds, with coins on top.
 */

import { offBeat, seeded, type SecretGame, type SecretInput } from './types';

type ObstacleKind = 'spike' | 'bar' | 'pit' | 'coin' | 'platform';

interface Obstacle {
  kind: ObstacleKind;
  beat: number;   // where it starts, in beats along the run
  len: number;    // pits and platforms span several beats
  done: boolean;  // collected / already cost a life
}

const JUMP_H = 0.2;            // apex height, in screen heights
const GRAVITY = 8 * JUMP_H;    // airtime of exactly one beat
const JUMP_V = GRAVITY / 2;
const PLATFORM_H = 0.12;
const PLAYER_H = 0.075;
const DUCK_H = 0.035;
const BAR_LOW = 0.05;
const ON_BEAT = 0.12;

export class RunnerLevel implements SecretGame {
  readonly title = 'ROOFTOP RUN';
  readonly hint = 'SPACE / ↑ / tap top half to jump · ↓ / tap bottom half to duck · jump on the beat';
  readonly totalBeats = 72;
  score = 0;
  lives = 4;
  done = false;
  won = false;

  private obstacles: Obstacle[] = [];
  private skyline: { x: number; w: number; h: number; layer: number }[] = [];
  private y = 0;
  private vy = 0;
  private duckUntil = -1;
  private hurtUntil = -1;
  private lastBeat = 0;
  private popups: { text: string; at: number; y: number }[] = [];

  constructor(private bpm: number) {
    const rand = seeded(4242);
    const add = (kind: ObstacleKind, beat: number, len = 0) => this.obstacles.push({ kind, beat, len, done: false });
    for (let b = 8; b < 24; b += 2) {
      add('spike', b + 0.5);
      if ((b / 2) % 2 === 0) add('coin', b + 0.5);
    }
    for (let b = 24; b < 40; b += 2) {
      const r = rand();
      if (r < 0.4) add('bar', b + 0.25);
      else if (r < 0.7) add('pit', b + 0.3, 0.8);
      else add('spike', b + 0.5);
    }
    for (let b = 40; b < 56; b += 5) {
      add('platform', b + 0.5, 3);
      add('coin', b + 2);
      add('coin', b + 3);
    }
    for (let b = 56; b < 68; b++) {
      const r = rand();
      if (r < 0.35) add('spike', b + 0.5);
      else if (r < 0.6) add('bar', b + 0.25);
      else if (r < 0.75) add('pit', b + 0.3, 0.8);
      else add('coin', b + 0.5);
    }
    for (let i = 0; i < 40; i++) {
      this.skyline.push({ x: rand() * 40, w: 0.6 + rand() * 1.6, h: 0.1 + rand() * 0.35, layer: i % 2 });
    }
  }

  private platformAt(b: number) {
    return this.obstacles.find((o) => o.kind === 'platform' && b >= o.beat && b <= o.beat + o.len);
  }

  private pitAt(b: number) {
    // A pit you already fell into is bridged so the respawn can't fall again
    return this.obstacles.find((o) => o.kind === 'pit' && !o.done && b >= o.beat && b <= o.beat + o.len);
  }

  private support(b: number) {
    if (this.platformAt(b)) return PLATFORM_H;
    if (this.pitAt(b)) return -1; // nothing to stand on
    return 0;
  }

  private grounded(b: number) {
    const s = this.support(b);
    return s >= 0 && Math.abs(this.y - s) < 0.002 && this.vy === 0;
  }

  input(a: SecretInput, beat: number) {
    if (this.done) return;
    let kind = a.kind;
    if (a.kind === 'pointer') kind = a.y < a.h * 0.55 ? 'jump' : 'duck';
    if ((kind === 'jump' || kind === 'fire') && this.grounded(beat)) {
      this.vy = JUMP_V;
      this.duckUntil = -1;
      if (offBeat(beat) < ON_BEAT) {
        this.score += 50;
        this.popups.push({ text: 'ON BEAT +50', at: beat, y: this.y });
      }
    } else if (kind === 'duck') {
      if (this.grounded(beat)) this.duckUntil = beat + 0.8;
      else this.vy = Math.min(this.vy, -JUMP_V); // fast-fall
    }
  }

  private hurt(beat: number) {
    if (beat < this.hurtUntil) return;
    this.lives--;
    this.hurtUntil = beat + 1.5;
    this.popups.push({ text: 'OUCH', at: beat, y: this.y });
  }

  update(beat: number, _dt: number) {
    if (this.done) return;
    const db = Math.max(0, Math.min(0.1, beat - this.lastBeat));
    this.lastBeat = beat;

    // Physics in beats: one jump lasts exactly one beat
    const prevY = this.y;
    const s = this.support(beat);
    if (this.vy !== 0 || this.y > Math.max(0, s) + 0.002 || s < 0) {
      this.vy -= GRAVITY * db;
      this.y += this.vy * db;
      const top = this.platformAt(beat) ? PLATFORM_H : this.pitAt(beat) ? -Infinity : 0;
      if (this.vy <= 0 && this.y <= top && prevY >= top - 0.01) {
        this.y = top;
        this.vy = 0;
      }
    }
    if (this.y < -0.15) {
      // Fell into a pit: lose a life and respawn on the far side
      this.hurt(beat);
      const pit = this.pitAt(beat);
      this.y = 0.06;
      this.vy = 0.2;
      if (pit) pit.done = true;
    }

    const ducking = beat < this.duckUntil;
    const top = this.y + (ducking ? DUCK_H : PLAYER_H);
    for (const o of this.obstacles) {
      if (o.done) continue;
      if (o.kind === 'spike' && Math.abs(beat - o.beat) < 0.12 && this.y < 0.05) {
        o.done = true;
        this.hurt(beat);
      } else if (o.kind === 'bar' && Math.abs(beat - o.beat) < 0.12 && top > BAR_LOW && this.y < BAR_LOW + 0.04) {
        o.done = true;
        this.hurt(beat);
      } else if (o.kind === 'coin' && Math.abs(beat - o.beat) < 0.15 && Math.abs(this.y + PLAYER_H / 2 - this.coinY(o)) < 0.08) {
        o.done = true;
        this.score += 200;
        this.popups.push({ text: '+200', at: beat, y: this.y });
      } else if (o.kind === 'platform' && beat > o.beat && beat < o.beat + o.len && this.y < 0.05) {
        // Spike bed under the platform
        this.hurt(beat);
      }
    }

    this.score += Math.round(db * 10);
    this.popups = this.popups.filter((p) => beat - p.at < 1.2);

    if (this.lives <= 0) {
      this.lives = 0;
      this.done = true;
    } else if (beat >= this.totalBeats) {
      this.done = true;
      this.won = true;
      this.score += this.lives * 500;
    }
  }

  private coinY(o: Obstacle) {
    return this.platformAt(o.beat) ? PLATFORM_H + 0.08 : JUMP_H * 0.85;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, beat: number) {
    const pulse = 1 - (((beat % 1) + 1) % 1);
    const groundY = h * 0.78;
    const px = w * 0.22;
    const beatPx = Math.max(110, w * 0.2);
    const sx = (b: number) => px + (b - beat) * beatPx;
    const sy = (y: number) => groundY - y * h;

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#12002B');
    sky.addColorStop(0.7, '#3B0A4F');
    sky.addColorStop(1, '#FF4FD8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Parallax skyline
    for (const b of this.skyline) {
      const speed = b.layer ? 0.5 : 0.25;
      const x = ((((b.x - beat * speed) % 40) + 40) % 40) * beatPx * 0.5 - beatPx;
      ctx.fillStyle = b.layer ? 'rgba(30,0,60,0.95)' : 'rgba(60,10,90,0.7)';
      ctx.fillRect(x, groundY - b.h * h * (b.layer ? 1 : 1.3), b.w * beatPx * 0.5, b.h * h * 2);
    }

    // Ground with beat ticks, broken by pits
    ctx.fillStyle = '#0A0014';
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.strokeStyle = `rgba(0,229,255,${0.6 + 0.4 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    for (let b = Math.floor(beat) - 2; b < beat + w / beatPx; b++) {
      ctx.fillStyle = 'rgba(0,229,255,0.35)';
      ctx.fillRect(sx(b) - 1, groundY + 4, 2, 10);
    }

    for (const o of this.obstacles) {
      const x = sx(o.beat);
      if (x > w + 200 || x + o.len * beatPx < -200) continue;
      if (o.kind === 'pit') {
        if (o.done) continue;
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, groundY - 2, o.len * beatPx, h - groundY + 2);
      } else if (o.kind === 'spike') {
        ctx.fillStyle = '#FF3B6B';
        ctx.shadowColor = '#FF3B6B';
        ctx.shadowBlur = 10;
        this.spikes(ctx, x - 14, groundY, 28, 3);
        ctx.shadowBlur = 0;
      } else if (o.kind === 'bar') {
        const y = sy(BAR_LOW + 0.02);
        ctx.strokeStyle = '#FF4FD8';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#FF4FD8';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(x - 30, y);
        ctx.lineTo(x + 30, y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - 34, y - 30, 4, 30 + (groundY - y));
        ctx.fillRect(x + 30, y - 30, 4, 30 + (groundY - y));
      } else if (o.kind === 'platform') {
        const width = o.len * beatPx;
        ctx.fillStyle = '#FF3B6B';
        this.spikes(ctx, x, groundY, width, Math.max(3, Math.floor(width / 18)));
        ctx.fillStyle = '#00E5FF';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 12;
        ctx.fillRect(x, sy(PLATFORM_H), width, 10);
        ctx.shadowBlur = 0;
      } else if (o.kind === 'coin' && !o.done) {
        const spin = Math.abs(Math.cos(beat * Math.PI * 2));
        ctx.fillStyle = '#FFD23F';
        ctx.shadowColor = '#FFD23F';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(x, sy(this.coinY(o)), 10 * spin + 2, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Runner
    const ducking = beat < this.duckUntil;
    const flicker = beat < this.hurtUntil && Math.floor(beat * 8) % 2 === 0;
    if (!flicker) {
      const bodyH = (ducking ? DUCK_H : PLAYER_H) * h;
      const bodyW = ducking ? 34 : 24;
      const y = sy(this.y);
      ctx.fillStyle = '#7CFFCB';
      ctx.shadowColor = '#7CFFCB';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.roundRect(px - bodyW / 2, y - bodyH, bodyW, bodyH, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#05010F';
      ctx.fillRect(px + 2, y - bodyH + 8, 5, 5);
      // Legs cycle on the beat while running
      if (this.y === 0 && !ducking) {
        const step = Math.sin(beat * Math.PI * 4) * 6;
        ctx.strokeStyle = '#7CFFCB';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(px - 5, y);
        ctx.lineTo(px - 5 + step, y + 8);
        ctx.moveTo(px + 5, y);
        ctx.lineTo(px + 5 - step, y + 8);
        ctx.stroke();
      }
    }

    ctx.font = '900 15px "Space Mono", monospace';
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      ctx.globalAlpha = 1 - (beat - p.at) / 1.2;
      ctx.fillStyle = p.text === 'OUCH' ? '#FF3B6B' : '#FFFFFF';
      ctx.fillText(p.text, px, sy(p.y) - PLAYER_H * h - 14 - (beat - p.at) * 24);
    }
    ctx.globalAlpha = 1;
  }

  private spikes(ctx: CanvasRenderingContext2D, x: number, groundY: number, width: number, n: number) {
    const sw = width / n;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      ctx.moveTo(x + i * sw, groundY);
      ctx.lineTo(x + i * sw + sw / 2, groundY - 22);
      ctx.lineTo(x + (i + 1) * sw, groundY);
    }
    ctx.fill();
  }
}
