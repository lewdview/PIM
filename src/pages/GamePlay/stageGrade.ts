// Cinematic grade over every stage background and POV scene, drawn once per frame after the
// environment and before the lane surface / notes: a horizon bloom in the song's colours that
// swells with the beat, a soft vignette that frames the highway, and a fine film grain.
// Rendering only. Lite graphics drops the grain and the bloom's beat swell.

import { colorWithAlpha } from './colorUtils';

let grain: HTMLCanvasElement | null = null;
let grainPattern: CanvasPattern | null = null;
let grainFor: CanvasRenderingContext2D | null = null;

function grainTile(): HTMLCanvasElement | null {
  if (grain) return grain;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grain = c;
  return c;
}

export interface GradeInput {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** Screen y of the horizon / vanishing point. */
  horizonY: number;
  /** 0..1 beat pulse. */
  beat: number;
  /** 0..1 combo energy. */
  energy: number;
  colors: string[];
  lite: boolean;
}

export function drawStageGrade(g: GradeInput): void {
  const { ctx, W, H, horizonY, colors, lite } = g;
  if (W <= 0 || H <= 0) return;
  ctx.save();

  // Horizon bloom: two song colours meeting at the vanishing point.
  const swell = lite ? 0 : g.beat * 0.06 + g.energy * 0.05;
  ctx.globalCompositeOperation = 'screen';
  const r = Math.max(W, H) * 0.55;
  const bloom = ctx.createRadialGradient(W / 2, horizonY, 0, W / 2, horizonY, r);
  bloom.addColorStop(0, colorWithAlpha(colors[1] || '#ff3d6e', 0.12 + swell));
  bloom.addColorStop(0.35, colorWithAlpha(colors[0] || '#39d0ff', 0.05 + swell * 0.5));
  bloom.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);

  // Vignette: frames the highway and pushes the eye to the centre.
  ctx.globalCompositeOperation = 'source-over';
  const vig = ctx.createRadialGradient(W / 2, H * 0.52, Math.min(W, H) * 0.35, W / 2, H * 0.52, Math.hypot(W, H) * 0.62);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Film grain: one cached noise tile, jittered every frame, overlaid very lightly.
  if (!lite) {
    const tile = grainTile();
    if (tile) {
      if (grainFor !== ctx || !grainPattern) {
        grainPattern = ctx.createPattern(tile, 'repeat');
        grainFor = ctx;
      }
      if (grainPattern) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.045;
        const ox = Math.floor(Math.random() * 128), oy = Math.floor(Math.random() * 128);
        ctx.translate(-ox, -oy);
        ctx.fillStyle = grainPattern;
        ctx.fillRect(0, 0, W + 128, H + 128);
      }
    }
  }
  ctx.restore();
}
