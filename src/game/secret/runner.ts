/**
 * Beat Runner — a beat platformer.
 *
 * The runner moves at one beat per step. Spikes and pits arrive half a
 * beat after a beat, so jumping on the beat clears them; laser bars come
 * at head height and are ducked. Later sections add raised platforms over
 * spike beds, with coins on top, and vertical lasers that must be blocked.
 */

import { offBeat, seeded, type SecretGame, type SecretInput } from './types';
import { RUNNER_COURSES, RUNNER_WHISTLES, runnerCourse, type RunnerObstacle, type RunnerStage, type RunnerWhistleId } from './runnerCourses';
import { drawRunnerSprite, type RunnerPose } from './runnerSprites';

const JUMP_H = 0.2;            // apex height, in screen heights
const GRAVITY = 8 * JUMP_H;    // airtime of exactly one beat
const JUMP_V = GRAVITY / 2;
const DOUBLE_JUMP_V = JUMP_V * 0.82;
const PLATFORM_H = 0.12;
const PLAYER_H = 0.12;
const DUCK_H = 0.088;
const BAR_LOW = 0.09;
const ON_BEAT = 0.12;
const SWING_BEATS = 0.88;
const BLOCK_BEATS = 0.94;
const TAUNT_BEATS = 1.5;
const DEFEAT_BEATS = 1.3;
const actionFrame = (elapsed: number, duration: number) => Math.min(9, Math.max(0, Math.floor(elapsed / duration * 10)));

export const SKIES = {
  1: ['#38204f', '#ad538f', '#fce4ff', '#41284f'],
  2: ['#12314a', '#246468', '#b1ffe5', '#234657'],
  3: ['#173957', '#285c89', '#b3efff', '#1f3d62'],
  4: ['#392744', '#8a5477', '#ffd9d2', '#5d3754'],
  5: ['#25203f', '#47348c', '#c6b4ff', '#352254'],
  6: ['#3c2136', '#97455e', '#ffd6af', '#502739'],
} as const;

export class RunnerLevel implements SecretGame {
  readonly title: string;
  readonly padHint = 'Controller: Ⓐ / ↑ jump (again in midair to double jump) · Ⓑ / ↓ slide · Ⓧ slash · LB / RB block · Ⓨ taunt';
  readonly hint = 'Space / ↑ jump · ↓ slide · X slash · C block · T taunt';
  readonly totalBeats: number;
  score = 0;
  lives = 4;
  done = false;
  won = false;
  foundWhistle: RunnerWhistleId | null = null;

  private readonly stage: RunnerStage;
  private readonly recovering: boolean;
  private readonly obstacles: RunnerObstacle[];
  private skyline: { x: number; w: number; h: number; layer: number }[] = [];
  private y = 0;
  private vy = 0;
  private duckUntil = -1;
  private hurtUntil = -1;
  private jumpAt = -Infinity;
  private doubleJumpAt = -Infinity;
  private swingAt = -Infinity;
  private blockAt = -Infinity;
  private tauntAt = -Infinity;
  private hitAt = -Infinity;
  private defeatAt = Infinity;
  private lastBeat = 0;
  private popups: { text: string; at: number; y: number }[] = [];

  constructor(stage: RunnerStage, recovering = false) {
    this.stage = stage;
    this.recovering = recovering;
    this.title = RUNNER_COURSES[stage].title;
    this.totalBeats = RUNNER_COURSES[stage].beats;
    const rand = seeded(4242);
    this.obstacles = runnerCourse(stage, rand);
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

  private canDoubleJump() {
    return this.jumpAt > -Infinity && this.doubleJumpAt === -Infinity;
  }

  private resetJump() {
    this.jumpAt = -Infinity;
    this.doubleJumpAt = -Infinity;
  }

  input(a: SecretInput, beat: number) {
    if (this.done || this.lives === 0 || beat < 0) return;
    let kind = a.kind;
    if (a.kind === 'pointer') kind = a.y < a.h * 0.55 ? 'jump' : 'duck';
    if (kind === 'jump' || kind === 'fire') {
      const onGround = this.grounded(beat);
      if (!onGround && !this.canDoubleJump()) return;
      this.vy = onGround ? JUMP_V : DOUBLE_JUMP_V;
      this.duckUntil = -1;
      this.tauntAt = -Infinity;
      this.blockAt = -Infinity;
      if (onGround) this.jumpAt = beat;
      else this.doubleJumpAt = beat;
      if (onGround && offBeat(beat) < ON_BEAT) {
        this.score += 50;
        this.popups.push({ text: 'ON BEAT +50', at: beat, y: this.y });
      }
    } else if (kind === 'duck') {
      this.tauntAt = -Infinity;
      this.blockAt = -Infinity;
      if (this.grounded(beat)) this.duckUntil = beat + 0.8;
      else this.vy = Math.min(this.vy, -JUMP_V); // fast-fall
    } else if (kind === 'attack' && beat >= this.swingAt + SWING_BEATS && !this.ducking(beat) && beat >= this.hitAt + 0.8) {
      this.swingAt = beat;
      this.blockAt = -Infinity;
      this.tauntAt = -Infinity;
    } else if (kind === 'block' && beat >= this.blockAt + BLOCK_BEATS && beat >= this.hitAt + 0.8) {
      this.blockAt = beat;
      this.duckUntil = -1;
      this.swingAt = -Infinity;
      this.tauntAt = -Infinity;
    } else if (kind === 'taunt' && this.grounded(beat) && !this.ducking(beat) && beat >= this.hitAt + 0.8
        && beat >= this.swingAt + SWING_BEATS && beat >= this.blockAt + BLOCK_BEATS && beat >= this.tauntAt + TAUNT_BEATS) {
      this.tauntAt = beat;
    }
  }

  private ducking(beat: number) {
    return beat < this.duckUntil;
  }

  private hurt(beat: number) {
    if (beat < this.hurtUntil) return;
    this.lives--;
    this.hitAt = beat;
    this.hurtUntil = beat + 1.5;
    this.swingAt = -Infinity;
    this.blockAt = -Infinity;
    this.tauntAt = -Infinity;
    if (!this.lives) this.defeatAt = beat;
    this.popups.push({ text: 'OUCH', at: beat, y: this.y });
  }

  private revealWhistle(id: RunnerWhistleId, beat: number) {
    this.foundWhistle = id;
    this.popups.push({ text: 'WARP WHISTLE!', at: beat, y: this.y });
  }

  update(beat: number, _dt: number) {
    if (this.done) return;
    if (!this.lives) {
      this.done = beat - this.defeatAt >= DEFEAT_BEATS;
      return;
    }
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
        this.resetJump();
      }
    }
    if (this.y < -0.15) {
      // Fell into a pit: lose a life and respawn on the far side
      this.hurt(beat);
      const pit = this.pitAt(beat);
      this.y = 0.06;
      this.vy = 0.2;
      this.resetJump();
      if (pit) pit.done = true;
    }

    const ducking = this.ducking(beat);
    const top = this.y + (ducking ? DUCK_H : PLAYER_H);
    for (const o of this.obstacles) {
      if (o.done) continue;
      if (o.kind === 'drone') {
        const distance = o.beat - beat;
        const swing = beat - this.swingAt;
        if (!ducking && swing >= 0.34 && swing <= 0.64 && distance >= -0.07 && distance <= 0.26 && Math.abs(this.y) < 0.11) {
          o.done = true;
          o.destroyedAt = beat;
          this.score += 350;
          this.popups.push({ text: 'SLASH +350', at: beat, y: this.y });
        } else if (Math.abs(distance) < 0.11 && this.y < 0.11) {
          o.done = true;
          this.hurt(beat);
        }
      } else if (o.kind === 'laser' && Math.abs(beat - o.beat) <= 0.11) {
        o.done = true;
        const guardAge = beat - this.blockAt;
        if (guardAge >= 0.16 && guardAge < BLOCK_BEATS) {
          o.destroyedAt = beat;
          this.score += 300;
          if (this.isGoldLaser(o)) this.revealWhistle('prism', beat);
          else this.popups.push({ text: 'BLOCK +300', at: beat, y: this.y });
        } else {
          this.hurt(beat);
        }
      } else if (o.kind === 'whistle' && Math.abs(beat - o.beat) <= 0.35 && this.grounded(beat) && beat - this.tauntAt < TAUNT_BEATS) {
        o.done = true;
        this.revealWhistle('rooftop', beat);
      } else if (o.kind === 'spike' && Math.abs(beat - o.beat) < 0.12 && this.y < 0.05) {
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

    if (this.lives > 0 && beat >= this.totalBeats) {
      this.done = true;
      this.won = true;
      this.score += this.lives * 500;
    }
  }

  private isGoldLaser(o: RunnerObstacle) {
    return this.stage === RUNNER_WHISTLES.prism.from && o.beat === RUNNER_WHISTLES.prism.beat;
  }

  private coinY(o: RunnerObstacle) {
    return this.platformAt(o.beat) ? PLATFORM_H + 0.08 : JUMP_H * 0.85;
  }

  private animation(beat: number): [RunnerPose, number] {
    if (!this.lives) return ['death', actionFrame(beat - this.defeatAt, DEFEAT_BEATS)];
    if (beat < 0) {
      if (this.recovering && beat >= -4 && beat < -1.8) return ['resurrect', actionFrame(beat + 4, 2.2)];
      return ['jump', 0];
    }
    if (beat - this.hitAt < 0.8) return ['damage', actionFrame(beat - this.hitAt, 0.8)];
    if (beat - this.blockAt < BLOCK_BEATS) return ['block', actionFrame(beat - this.blockAt, BLOCK_BEATS)];
    if (this.ducking(beat)) return ['slide', Math.min(9, 3 + Math.floor((beat - this.duckUntil + 0.8) * 7 / 0.8))];
    if (beat - this.swingAt < SWING_BEATS) return ['attack', actionFrame(beat - this.swingAt, SWING_BEATS)];
    if (this.doubleJumpAt > -Infinity) return ['doubleJump', Math.max(2, actionFrame(beat - this.doubleJumpAt, 0.94))];
    if (this.vy !== 0) return ['jump', Math.max(2, actionFrame(beat - this.jumpAt, 1))];
    if (beat - this.tauntAt < TAUNT_BEATS) return ['taunt', actionFrame(beat - this.tauntAt, TAUNT_BEATS)];
    return ['run', Math.floor(beat % 1 * 10)];
  }

  snapshot(beat: number, w: number, h: number) {
    const [pose, frame] = this.animation(beat);
    const courseBeat = Math.min(beat, this.defeatAt);
    const beatPx = this.beatPixels(w);
    return {
      stage: this.stage, beat, pose, frame, lives: this.lives, score: this.score, won: this.won, whistle: this.foundWhistle,
      coordinates: 'Canvas pixels from the top left. Player y is at the feet.',
      player: { x: w * 0.22, y: h * (0.78 - this.y), grounded: this.grounded(courseBeat), canDoubleJump: this.canDoubleJump() },
      obstacles: this.obstacles.filter(o => !o.done && o.beat + o.len >= courseBeat - 1 && o.beat <= courseBeat + w * 0.78 / beatPx)
        .map(({ kind, beat, len }) => ({ kind, beat, len, x: w * 0.22 + (beat - courseBeat) * beatPx })),
    };
  }

  private beatPixels(w: number) {
    return Math.max(72, w * 0.2);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
    const beat = Math.min(time, this.defeatAt);
    const pulse = 1 - (((beat % 1) + 1) % 1);
    const groundY = h * 0.78;
    const px = w * 0.22;
    const beatPx = this.beatPixels(w);
    const sx = (b: number) => px + (b - beat) * beatPx;
    const sy = (y: number) => groundY - y * h;
    const [skyColor, horizon, moonColor, skyline] = SKIES[this.stage];

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#100b27');
    sky.addColorStop(0.48, skyColor);
    sky.addColorStop(0.79, horizon);
    sky.addColorStop(1, '#240d34');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const moon = ctx.createRadialGradient(w * 0.66, h * 0.36, 0, w * 0.66, h * 0.36, h * 0.21);
    moon.addColorStop(0, moonColor);
    moon.addColorStop(0.45, moonColor);
    moon.addColorStop(0.46, `${moonColor}52`);
    moon.addColorStop(1, 'transparent');
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, w, h);

    // Parallax skyline
    for (const b of this.skyline) {
      const speed = b.layer ? 0.5 : 0.25;
      const x = ((((b.x - beat * speed) % 40) + 40) % 40) * beatPx * 0.5 - beatPx;
      const roof = groundY - b.h * h * (b.layer ? 1 : 1.3);
      const width = b.w * beatPx * 0.5;
      if (x >= w || x + width <= 0) continue;
      ctx.fillStyle = b.layer ? '#151229' : skyline;
      ctx.fillRect(x, roof, width, groundY - roof);
      ctx.fillStyle = b.layer ? '#e7a9ef39' : '#f6c8e52b';
      ctx.fillRect(x, roof, width, 2);
      for (let col = 10; col < width - 7; col += 18) {
        for (let row = 14; roof + row < groundY - 8; row += 23) {
          if ((col + row + Math.floor(b.x * 9)) % 5 < 2) ctx.fillRect(x + col, roof + row, 7, 3);
        }
      }
    }

    // Ground with beat ticks, broken by pits
    ctx.fillStyle = '#0A0014';
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.strokeStyle = `rgba(124,255,235,${0.54 + 0.46 * pulse})`;
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
      } else if (o.kind === 'drone') {
        const y = sy(0.065);
        if (!o.done) this.drawDrone(ctx, x, y + Math.sin(beat * Math.PI * 2) * 3, h, pulse);
        if (o.destroyedAt !== undefined && time - o.destroyedAt < 0.44) {
          this.drawBurst(ctx, x, y, (time - o.destroyedAt) / 0.44, '#feb8ed');
        }
      } else if (o.kind === 'laser') {
        const color = this.isGoldLaser(o) ? '#ffda81' : '#6bfaff';
        if (!o.done) {
          this.drawLaser(ctx, x, groundY, h, pulse, color);
          ctx.fillStyle = color;
          ctx.fillRect(sx(Math.floor(o.beat)) - 2, groundY + 3, 4, 11);
        }
        if (o.destroyedAt !== undefined && time - o.destroyedAt < 0.44) {
          this.drawBurst(ctx, Math.max(px, x), sy(0.08), (time - o.destroyedAt) / 0.44, color);
        }
      } else if (o.kind === 'whistle') {
        this.drawSpeaker(ctx, x, groundY, pulse, o.done);
      } else if (o.kind === 'spike') {
        ctx.fillStyle = '#FF3B6B';
        ctx.shadowColor = '#FF3B6B';
        ctx.shadowBlur = 10;
        this.spikes(ctx, x - 14, groundY, 28, 3, h * 0.05);
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
        this.spikes(ctx, x, groundY, width, Math.max(3, Math.floor(width / 18)), h * 0.05);
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

    const [pose, frame] = this.animation(time);
    const y = sy(this.y);
    const size = Math.min(h * 0.155, w * 0.43);
    ctx.save();
    ctx.shadowColor = '#ff8de9a8';
    ctx.shadowBlur = 10;
    if (time >= this.hitAt + 0.8 && time < this.hurtUntil && Math.floor(time * 8) % 2 === 0) ctx.globalAlpha = 0.55;
    if (!drawRunnerSprite(ctx, pose, frame, px, y, size)) {
      const bodyH = (pose === 'slide' || pose === 'death' ? DUCK_H : PLAYER_H) * h;
      const bodyW = pose === 'slide' || pose === 'death' ? 34 : 24;
      ctx.fillStyle = '#7CFFCB';
      ctx.beginPath();
      ctx.roundRect(px - bodyW / 2, y - bodyH, bodyW, bodyH, 8);
      ctx.fill();
    }
    ctx.restore();

    ctx.font = '900 15px "Space Mono", monospace';
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      const age = time - p.at;
      if (age >= 1.2) continue;
      ctx.globalAlpha = 1 - age / 1.2;
      ctx.fillStyle = p.text === 'OUCH' ? '#FF829D' : p.text === 'WARP WHISTLE!' ? '#ffda81' : '#FFFFFF';
      ctx.fillText(p.text, px, sy(p.y) - size - 12 - age * 24);
    }
    ctx.globalAlpha = 1;
  }

  private drawLaser(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number, pulse: number, color: string) {
    const top = groundY - h * 0.50;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 + pulse * 10;
    ctx.globalAlpha = 0.35 + pulse * 0.3;
    ctx.fillRect(x - 7, top, 14, groundY - top);
    ctx.globalAlpha = 1;
    ctx.fillRect(x - 2, top, 4, groundY - top);
    ctx.fillRect(x - 12, top - 4, 24, 6);
    ctx.fillRect(x - 12, groundY - 5, 24, 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f5ffff';
    ctx.fillRect(x - 0.5, top + 3, 1, groundY - top - 6);
    ctx.restore();
  }

  private drawSpeaker(ctx: CanvasRenderingContext2D, x: number, groundY: number, pulse: number, opened: boolean) {
    ctx.save();
    ctx.translate(x, groundY - 21);
    ctx.fillStyle = '#29203c';
    ctx.strokeStyle = opened ? '#66583a' : '#f5ce79';
    ctx.shadowColor = '#f7b94a';
    ctx.shadowBlur = opened ? 0 : pulse * 12;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-14, -21, 28, 42, 3);
    ctx.fill();
    ctx.stroke();
    for (const [y, radius] of [[-10, 4], [6, 8]]) {
      ctx.beginPath();
      ctx.arc(0, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawDrone(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, pulse: number) {
    const radius = Math.max(12, Math.min(24, h * 0.027));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radius, radius);
    ctx.fillStyle = '#260f34';
    ctx.strokeStyle = '#e4a5ff';
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(-1.2, 0);
    ctx.lineTo(-0.55, -0.75);
    ctx.lineTo(0.55, -0.75);
    ctx.lineTo(1.2, 0);
    ctx.lineTo(0.52, 0.62);
    ctx.lineTo(-0.52, 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pulse > 0.4 ? '#ff9ab8' : '#ff4b8b';
    ctx.fillRect(-0.47, -0.16, 0.94, 0.24);
    ctx.restore();
  }

  private drawBurst(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, color: string) {
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const radius = 8 + 31 * progress;
      ctx.moveTo(x + dx * radius, y + dy * radius);
      ctx.lineTo(x + dx * (radius + 8), y + dy * (radius + 8));
    }
    ctx.stroke();
    ctx.restore();
  }

  private spikes(ctx: CanvasRenderingContext2D, x: number, groundY: number, width: number, n: number, height: number) {
    const sw = width / n;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      ctx.moveTo(x + i * sw, groundY);
      ctx.lineTo(x + i * sw + sw / 2, groundY - height);
      ctx.lineTo(x + (i + 1) * sw, groundY);
    }
    ctx.fill();
  }
}
