import type { SecretGame } from './types';

const INK = '#100e20';
const BEAT_COLOR = '#9bf7e3';

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#100e22de';
  ctx.strokeStyle = '#c5abf153';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
}

export function drawRunnerHud(ctx: CanvasRenderingContext2D, w: number, h: number, game: SecretGame, beat: number) {
  const pad = 14;
  const score = game.score.toLocaleString();
  const current = Math.floor(beat);
  const phase = beat - current;
  const active = ((current % 4) + 4) % 4;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.font = '800 17px "JetBrains Mono", monospace';

  const scoreWidth = Math.max(78, 28 + ctx.measureText(score).width);
  pill(ctx, pad, pad, scoreWidth, 34);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff1fd';
  ctx.fillText(score, pad + 13, pad + 17);

  const heartWidth = 72;
  const heartsX = w - pad - 42 - heartWidth;
  pill(ctx, heartsX, pad, heartWidth, 34);
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i < game.lives ? '#ff719c' : '#826783';
    ctx.fillText('♥', heartsX + 13 + i * 15, pad + 17);
  }

  // Keep the beat pips between the status plates, even on narrow phones.
  const beatX = Math.max(pad + scoreWidth + 36, Math.min(w / 2, heartsX - 36));
  if (heartsX - pad - scoreWidth >= 72) {
    pill(ctx, beatX - 32, pad + 3, 64, 28);
    for (let i = 0; i < 4; i++) {
      const x = beatX - 21 + i * 14;
      ctx.globalAlpha = i === active ? 1 - phase * 0.53 : 0.45;
      ctx.fillStyle = i === active ? BEAT_COLOR : '#94a1b9';
      ctx.fillRect(x - 3, pad + 12, 6, 10);
    }
    ctx.globalAlpha = 1;
  }

  const track = w - pad * 2;
  const progress = Math.max(0, Math.min(1, beat / game.totalBeats));
  ctx.fillStyle = '#3e334f';
  ctx.fillRect(pad, pad + 43, track, 3);
  ctx.fillStyle = '#d3a6ff';
  ctx.fillRect(pad, pad + 43, progress * track, 3);
  for (const section of [0.25, 0.5, 0.75]) {
    ctx.fillStyle = '#edd7fa80';
    ctx.fillRect(pad + section * track, pad + 42, 1, 5);
  }

  if (beat < 0) {
    const count = Math.min(4, Math.ceil(-beat));
    const y = h * 0.44;
    const radius = Math.min(48, h * 0.14);
    ctx.translate(w / 2, y);
    ctx.fillStyle = INK;
    ctx.strokeStyle = '#dab6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = BEAT_COLOR;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 5, -Math.PI / 2, -Math.PI / 2 + phase * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff0fa';
    ctx.font = `900 ${Math.floor(radius * 1.16)}px "JetBrains Mono", monospace`;
    ctx.fillText(String(count), 0, 1);
  }
  ctx.restore();
}
