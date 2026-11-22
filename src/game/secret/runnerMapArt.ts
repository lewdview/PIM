import { RUNNER_STAGES, RUNNER_WHISTLES, type RunnerStage } from './runnerCourses';
import { drawRunnerSprite } from './runnerSprites';
import { seeded } from './types';
import type { readRunnerProgress } from './runnerProgress';

type Point = readonly [number, number];
type MapLayout = Record<RunnerStage, Point>;

const WIDE_MAP: MapLayout = { 1: [13, 66], 2: [28, 53], 3: [43, 65], 4: [56, 43], 5: [72, 56], 6: [87, 39] };
const TALL_MAP: MapLayout = { 1: [24, 19], 2: [67, 26], 3: [27, 43], 4: [68, 53], 5: [29, 70], 6: [70, 82] };

export const MAP_REGIONS = [
  { name: 'Neon Heights', ink: '#b181ff', face: '#231837', right: '#322244', wide: [20, 64, 19, 22], tall: [47, 22, 44, 13], label: [[6, 34], [7, 4]] },
  { name: 'Prism Grid', ink: '#67ecd9', face: '#102a38', right: '#174451', wide: [50, 57, 21, 25], tall: [51, 47, 45, 14], label: [[38, 25], [7, 32]] },
  { name: 'Null Network', ink: '#ff9e98', face: '#321d35', right: '#4f283d', wide: [81, 48, 20, 27], tall: [51, 75, 45, 15], label: [[70, 15], [7, 61]] },
] as const;

const ISLAND: Point[] = [
  [-1, -0.02], [-0.72, -0.56], [-0.29, -0.71], [0.05, -0.96], [0.48, -0.79], [0.82, -0.60],
  [1, -0.02], [0.87, 0.42], [0.56, 0.66], [0.12, 0.94], [-0.43, 0.82], [-0.78, 0.57],
];

export function runnerMapLayout(compact: boolean) {
  return compact ? TALL_MAP : WIDE_MAP;
}

function outline(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
}

function building(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, height: number, region: typeof MAP_REGIONS[number]) {
  const dx = w * 0.36;
  const dy = w * 0.30;
  const roof = y - height;
  outline(ctx, [[x, y], [x + w, y], [x + w, roof], [x, roof]]);
  ctx.fillStyle = region.face;
  ctx.fill();
  outline(ctx, [[x + w, y], [x + w + dx, y - dy], [x + w + dx, roof - dy], [x + w, roof]]);
  ctx.fillStyle = region.right;
  ctx.fill();
  outline(ctx, [[x, roof], [x + dx, roof - dy], [x + w + dx, roof - dy], [x + w, roof]]);
  ctx.fillStyle = '#171325';
  ctx.fill();
  ctx.strokeStyle = `${region.ink}9d`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = `${region.ink}b0`;
  ctx.fillRect(x + w * 0.39, roof - dy * 0.44, w * 0.51, 1.5);
  const rows = Math.floor(height / 9);
  const cols = Math.max(2, Math.floor(w / 8));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillStyle = (row * 7 + col + Math.round(y)) % 5 < 2 ? `${region.ink}ad` : `${region.ink}2d`;
      ctx.fillRect(x + (col + 0.52) * w / cols, roof + 5 + row * 8, w / cols * 0.39, 2.2);
    }
  }
}

function paintRegion(ctx: CanvasRenderingContext2D, w: number, h: number, compact: boolean, region: typeof MAP_REGIONS[number], index: number) {
  const [mx, my, rw, rh] = compact ? region.tall : region.wide;
  const [cx, cy, rx, ry] = [w * mx / 100, h * my / 100, w * rw / 100, h * rh / 100];
  const points: Point[] = ISLAND.map(([x, y]) => [cx + x * rx, cy + y * ry]);
  const depth = compact ? 10 : 16;
  outline(ctx, points.map(([x, y]) => [x, y + depth]));
  ctx.fillStyle = '#0b0918';
  ctx.fill();
  ctx.strokeStyle = `${region.ink}5c`;
  ctx.stroke();

  outline(ctx, points);
  const deck = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
  deck.addColorStop(0, region.face);
  deck.addColorStop(1, '#110d22');
  ctx.fillStyle = deck;
  ctx.fill();
  ctx.strokeStyle = `${region.ink}90`;
  ctx.stroke();

  ctx.save();
  ctx.clip();
  ctx.strokeStyle = `${region.ink}22`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = -2 * ry; y <= 2 * ry; y += compact ? 9 : 13) {
    ctx.moveTo(cx - rx, cy + y);
    ctx.lineTo(cx + rx, cy + y + rx * 0.57);
    ctx.moveTo(cx + rx, cy + y);
    ctx.lineTo(cx - rx, cy + y + rx * 0.57);
  }
  ctx.stroke();
  ctx.restore();

  const rand = seeded(760 + index * 113);
  for (const [dx, dy] of [[-0.7, 0.26], [-0.44, -0.31], [-0.21, 0.44], [-0.13, -0.57], [0.20, -0.32], [0.37, 0.35], [0.54, -0.30], [0.72, 0.10]]) {
    const scale = compact ? 0.78 : 1;
    const size = (17 + rand() * 23) * scale;
    const height = (18 + rand() * (32 + index * 9)) * scale;
    const x = cx + dx * rx - size * 0.5;
    const y = cy + dy * ry;
    building(ctx, x, y, size, height, region);
    if (height > 41) {
      ctx.strokeStyle = `${region.ink}72`;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.68, y - height - size * 0.17);
      ctx.lineTo(x + size * 0.68, y - height - size * 0.17 - 10 * scale);
      ctx.stroke();
      ctx.fillStyle = region.ink;
      ctx.fillRect(x + size * 0.68 - 1, y - height - size * 0.17 - 10 * scale, 2, 2);
    }
  }
}

export function drawRunnerMap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  compact: boolean,
  progress: ReturnType<typeof readRunnerProgress>,
  selected: RunnerStage,
  frame = 0,
) {
  const background = ctx.createLinearGradient(0, 0, w * 0.58, h);
  background.addColorStop(0, '#0c1024');
  background.addColorStop(0.53, '#110d25');
  background.addColorStop(1, '#0a101e');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);

  const rand = seeded(39);
  for (let i = 0; i < 160; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillStyle = i % 8 === 0 ? '#8085a18c' : '#8279b639';
    ctx.fillRect(x, y, i % 8 === 0 ? 2 : 1, 1);
  }

  ctx.strokeStyle = '#8c8bcc25';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(w * 0.85, h * 0.19, w * 0.09 * i, h * 0.095 * i, -0.18, 0, Math.PI * 2);
    ctx.stroke();
  }
  MAP_REGIONS.forEach((region, i) => paintRegion(ctx, w, h, compact, region, i));

  const layout = runnerMapLayout(compact);
  const point = (stage: RunnerStage): Point => [layout[stage][0] * w / 100, layout[stage][1] * h / 100];

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [index, from] of RUNNER_STAGES.slice(0, -1).entries()) {
    const [x, y] = point(from);
    const [nx, ny] = point(RUNNER_STAGES[index + 1]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + nx) / 2, y + (ny - y) * 0.13, nx, ny);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#090815';
    ctx.lineWidth = 8;
    ctx.stroke();
    const active = progress.cleared.includes(from);
    ctx.setLineDash(active ? [] : [4, 8]);
    ctx.strokeStyle = active ? '#68e8d7' : '#7a6b9e';
    ctx.lineWidth = active ? 2.4 : 1.8;
    ctx.stroke();
  }
  for (const id of ['rooftop', 'prism'] as const) {
    if (progress.whistles[id] === 'hidden') continue;
    const { from, to } = RUNNER_WHISTLES[id];
    const [x, y] = point(from);
    const [nx, ny] = point(to);
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (compact) ctx.bezierCurveTo(w * 0.08, y + 20, w * 0.08, ny - 5, nx, ny);
    else ctx.bezierCurveTo(x + w * 0.07, y + h * 0.34, nx - w * 0.08, ny + h * 0.30, nx, ny);
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = progress.whistles[id] === 'opened' ? '#ffda86' : '#ad854f';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();

  if (progress.available.includes(selected)) {
    const [x, y] = point(selected);
    ctx.save();
    ctx.shadowBlur = 11;
    ctx.shadowColor = '#f5a1fd9c';
    drawRunnerSprite(ctx, 'idle', frame, x + (compact ? 24 : -28), y - (compact ? 24 : 30), compact ? 56 : 74);
    ctx.restore();
  }
}
