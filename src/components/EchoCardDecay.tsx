import React, { useEffect, useRef } from 'react';

interface EchoCardDecayProps {
  /** The source card's day number — used for deterministic seeding */
  sourceDay: number;
  /** Echo generation (0 = fresh, 1-2 = degrading, 3+ = near-entropy) */
  generation: number;
  /** The card cover image URL */
  coverUrl: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Deterministic LCG seeded by (sourceDay * generation) — no external package required */
function makeLcg(seed: number) {
  let s = (seed ^ 0x5deece66d) & 0xffffffff;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function applyDecayEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  generation: number,
  rand: () => number
): void {
  if (generation <= 0) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  if (generation >= 1) {
    // Gen 1: subtle hue shift + 20% desaturation per generation
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const grey = r * 0.299 + g * 0.587 + b * 0.114;
      const desat = Math.min(0.7, 0.2 * generation);
      data[i] = Math.round(r + (grey - r) * desat);
      data[i + 1] = Math.round(g + (grey - g) * desat);
      data[i + 2] = Math.round(b + (grey - b) * desat);
    }
  }

  if (generation >= 2) {
    // Gen 2: chromatic aberration (RGB channel shift)
    const shift = Math.round(4 * (generation - 1));
    const orig = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        // Red channel: shift right
        const rx = Math.min(width - 1, x + shift);
        data[i] = orig[(y * width + rx) * 4];
        // Blue channel: shift left
        const bx = Math.max(0, x - shift);
        data[i + 2] = orig[(y * width + bx) * 4 + 2];
      }
    }
  }

  if (generation >= 3) {
    // Gen 3+: random digital glitch blocks
    const blockCount = Math.floor(18 * (generation - 2));
    const orig = new Uint8ClampedArray(data);
    for (let b = 0; b < blockCount; b++) {
      const bx = Math.floor(rand() * Math.max(1, width - 20));
      const by = Math.floor(rand() * Math.max(1, height - 8));
      const bw = Math.floor(rand() * 40) + 10;
      const bh = Math.floor(rand() * 8) + 4;
      const srcX = Math.floor(rand() * Math.max(1, width - bw));
      const srcY = Math.floor(rand() * Math.max(1, height - bh));
      for (let dy = 0; dy < bh; dy++) {
        for (let dx = 0; dx < bw; dx++) {
          const di = ((by + dy) * width + (bx + dx)) * 4;
          const si = ((srcY + dy) * width + (srcX + dx)) * 4;
          if (di < data.length && si < orig.length) {
            data[di] = orig[si];
            data[di + 1] = orig[si + 1];
            data[di + 2] = orig[si + 2];
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Task 4D: Renders card artwork with procedural entropy decay based on Echo generation.
 * Generation 0 = pristine original.
 * Generation 1 = subtle desaturation + scan drift.
 * Generation 2 = chromatic aberration.
 * Generation 3+ = digital entropy glitch blocks.
 * Seeding is deterministic per (sourceDay * generation).
 */
export const EchoCardDecay: React.FC<EchoCardDecayProps> = ({
  sourceDay,
  generation,
  coverUrl,
  className = '',
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      canvas.width = img.naturalWidth || 400;
      canvas.height = img.naturalHeight || 400;
      ctx.drawImage(img, 0, 0);

      if (generation > 0) {
        try {
          const rand = makeLcg(sourceDay * Math.max(1, generation));
          applyDecayEffect(ctx, canvas.width, canvas.height, generation, rand);

          if (generation >= 3) {
            ctx.fillStyle = 'rgba(0, 255, 100, 0.04)';
            for (let y = 0; y < canvas.height; y += 4) {
              ctx.fillRect(0, y, canvas.width, 2);
            }
          }
        } catch {
          // Gracefully fallback if canvas is tainted by cross-origin
        }
      }
    };
    img.onerror = () => {
      if (cancelled) return;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgba(0, 255, 100, ${0.2 + generation * 0.15})`;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`ECHO GEN ${generation}`, canvas.width / 2, canvas.height / 2);
    };
    img.src = coverUrl;

    return () => {
      cancelled = true;
    };
  }, [coverUrl, generation, sourceDay]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', maxWidth: '100%', height: 'auto', ...style }}
    />
  );
};

export default EchoCardDecay;
