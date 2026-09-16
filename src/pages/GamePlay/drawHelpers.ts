import { colorWithAlpha } from './colorUtils';
import { MATRIX_COLUMNS } from './constants';
import { getStageGeometry } from './geometry';
import type { TrackArchetype } from './archetypes';

export const refineAndBlendEdges = (canvas: HTMLCanvasElement, threshold: number) => {
  try {
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Green screen spill suppression & soft edge blending without deleting dark subjects
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const isGreen = g > r * 1.18 && g > b * 1.18;
      if (isGreen) {
        data[i + 1] = Math.round((r + b) / 2);
        data[i + 3] = Math.round(data[i + 3] * 0.15); // Fade green backdrop
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    // Gracefully ignore SecurityError when canvas is tainted by cross-origin assets
  }
};


export function disposeCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
  } catch {}
}


export function drawMovingGasAura(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  baseColor: string,
  t: number,
  intensity: number = 1.0,
  skipTendrils: boolean = false
) {
  ctx.save();

  // ── 1. Undulating Multi-Frequency Radial Noise Gas Field ──
  const gasR = Math.max(12, baseRadius * (1.0 + 0.04 * Math.sin(t * 1.5)));
  const gasGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, gasR);
  gasGrad.addColorStop(0, colorWithAlpha(baseColor, 0.88 * intensity));
  gasGrad.addColorStop(0.35, colorWithAlpha(baseColor, 0.62 * intensity));
  gasGrad.addColorStop(0.70, colorWithAlpha(baseColor, 0.28 * intensity));
  gasGrad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");

  ctx.fillStyle = gasGrad;
  ctx.beginPath();
  const numPoints = skipTendrils ? 16 : 28;
  for (let i = 0; i <= numPoints; i++) {
    const ang = (i / numPoints) * Math.PI * 2;
    // Multi-frequency organic trigonometric noise harmonics
    const noise = 1.0
      + 0.08 * Math.sin(ang * 3 + t * 1.6)
      + 0.06 * Math.cos(ang * 5 - t * 2.2)
      + 0.04 * Math.sin(ang * 8 + t * 3.4);
    const r = gasR * noise;
    const gx = cx + Math.cos(ang) * r;
    const gy = cy + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(gx, gy);
    else ctx.lineTo(gx, gy);
  }
  ctx.closePath();
  ctx.fill();

  // ── 2. Dynamic Swirling Dark Smoke Tendrils & Gas Wisps ──
  if (!skipTendrils) {
    const tendrilCount = 4;
    for (let i = 0; i < tendrilCount; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      const tendrilAng = (i / tendrilCount) * Math.PI * 2 + t * 0.7 * dir;
      const distP = 0.55 + 0.30 * Math.sin(t * 1.2 + i * 1.5);
      const tx = cx + Math.cos(tendrilAng) * (baseRadius * distP);
      const ty = cy + Math.sin(tendrilAng) * (baseRadius * distP * 0.75);
      const tw = Math.max(4, baseRadius * (0.28 + 0.12 * Math.sin(t * 1.8 + i)));

      const wispGrad = ctx.createRadialGradient(tx, ty, 2, tx, ty, tw);
      wispGrad.addColorStop(0, colorWithAlpha(baseColor, 0.35 * intensity));
      wispGrad.addColorStop(0.55, colorWithAlpha(baseColor, 0.14 * intensity));
      wispGrad.addColorStop(1, "rgba(0, 0, 0, 0.0)");

      ctx.fillStyle = wispGrad;
      ctx.beginPath();
      ctx.arc(tx, ty, tw, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
