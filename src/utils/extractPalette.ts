/**
 * extractPalette.ts — Dynamic color palette extraction from cover artwork
 *
 * Loads an image into an offscreen canvas, samples pixels, clusters them
 * via simplified k-means, and returns dominant / secondary / accent colors
 * as HSL + hex + RGB values. Used by HeroLandingPage to dynamically theme
 * the entire page to today's artwork.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface PaletteColor {
  h: number;   // 0-360
  s: number;   // 0-100
  l: number;   // 0-100
  hex: string;
  rgb: [number, number, number];
}

export interface ExtractedPalette {
  dominant: PaletteColor;
  secondary: PaletteColor;
  accent: PaletteColor;
  muted: PaletteColor;
  dark: PaletteColor;
  colors: PaletteColor[];
}

// ── Color Math ─────────────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function makePaletteColor(rgb: [number, number, number]): PaletteColor {
  const [h, s, l] = rgbToHsl(...rgb);
  return { h, s, l, hex: rgbToHex(...rgb), rgb };
}

// ── K-means Clustering ─────────────────────────────────────────────────

function kMeans(
  pixels: [number, number, number][],
  k: number,
  iterations = 12,
): [number, number, number][] {
  // Seed centroids from evenly-spaced samples
  const step = Math.max(1, Math.floor(pixels.length / k));
  let centroids: [number, number, number][] = Array.from(
    { length: k },
    (_, i) => [...pixels[Math.min(i * step, pixels.length - 1)]] as [number, number, number],
  );

  for (let iter = 0; iter < iterations; iter++) {
    const clusters: [number, number, number][][] = Array.from({ length: k }, () => []);

    for (const pixel of pixels) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let c = 0; c < k; c++) {
        const dist = colorDistance(pixel, centroids[c]);
        if (dist < minDist) { minDist = dist; minIdx = c; }
      }
      clusters[minIdx].push(pixel);
    }

    centroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i];
      const sum: [number, number, number] = [0, 0, 0];
      for (const p of cluster) { sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; }
      return [
        Math.round(sum[0] / cluster.length),
        Math.round(sum[1] / cluster.length),
        Math.round(sum[2] / cluster.length),
      ] as [number, number, number];
    });
  }

  return centroids;
}

// ── Public API ─────────────────────────────────────────────────────────

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function generateHarmonicPaletteFromUrl(url: string): ExtractedPalette {
  const hash = hashString(url || 'default');
  const baseHue = hash % 360;
  const secondaryHue = (baseHue + 50 + (hash % 40)) % 360;
  const accentHue = (baseHue + 180 + (hash % 30) - 15) % 360;

  const dominant = makePaletteColor(hslToRgb(baseHue, 95, 50));
  const secondary = makePaletteColor(hslToRgb(secondaryHue, 85, 55));
  const accent = makePaletteColor(hslToRgb(accentHue, 100, 52));
  const muted = makePaletteColor(hslToRgb(baseHue, 30, 42));
  const dark = makePaletteColor(hslToRgb((baseHue + 20) % 360, 45, 10));

  return {
    dominant,
    secondary,
    accent,
    muted,
    dark,
    colors: [dominant, secondary, accent, muted, dark]
  };
}

/** Brand-aligned fallback palette when extraction fails or there are too few distinct pixels. */
export function getFallbackPalette(): ExtractedPalette {
  const dominant: PaletteColor = { h: 16, s: 100, l: 50, hex: '#ff3800', rgb: [255, 56, 0] };
  const secondary: PaletteColor = { h: 280, s: 65, l: 55, hex: '#a855f7', rgb: [168, 85, 247] };
  const accent: PaletteColor = { h: 180, s: 100, l: 45, hex: '#00e5ff', rgb: [0, 229, 255] };
  const muted: PaletteColor = { h: 0, s: 0, l: 40, hex: '#666666', rgb: [102, 102, 102] };
  const dark: PaletteColor = { h: 240, s: 20, l: 8, hex: '#0c0c14', rgb: [12, 12, 20] };
  return { dominant, secondary, accent, muted, dark, colors: [dominant, secondary, accent, muted, dark] };
}

/**
 * Extract a 5-color palette from an image URL.
 *
 * For same-origin / blob / data URLs, samples pixels via offscreen canvas k-means.
 * For external non-CORS CDNs, seamlessly derives a deterministic 5-color harmonic palette.
 */
export function extractPalette(imageUrl: string): Promise<ExtractedPalette> {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(getFallbackPalette());
      return;
    }

    const isBlobOrData = imageUrl.startsWith('blob:') || imageUrl.startsWith('data:');
    const isSameOrigin = typeof window !== 'undefined' && imageUrl.startsWith(window.location.origin);

    // If external non-CORS host like files.th3scr1b3.art, avoid browser CORS network block
    // by synthesizing harmonic palette from URL hash
    if (!isBlobOrData && !isSameOrigin && imageUrl.includes('files.th3scr1b3.art')) {
      resolve(generateHarmonicPaletteFromUrl(imageUrl));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(generateHarmonicPaletteFromUrl(imageUrl)); return; }

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const pixels: [number, number, number][] = [];

        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];
          if (a < 128) continue;
          const brightness = (r + g + b) / 3;
          if (brightness < 15 || brightness > 240) continue;
          pixels.push([r, g, b]);
        }

        if (pixels.length < 5) { resolve(generateHarmonicPaletteFromUrl(imageUrl)); return; }

        const centroids = kMeans(pixels, 5);
        const colors = centroids.map(makePaletteColor);

        // Sort by vibrancy: saturation × distance-from-extreme-lightness
        colors.sort(
          (a, b) =>
            b.s * (100 - Math.abs(b.l - 50)) - a.s * (100 - Math.abs(a.l - 50)),
        );

        resolve({
          dominant: colors[0],
          secondary: colors[1] || colors[0],
          accent: colors[2] || colors[0],
          muted: colors[3] || colors[0],
          dark: colors[4] || colors[0],
          colors,
        });
      } catch {
        resolve(generateHarmonicPaletteFromUrl(imageUrl));
      }
    };

    img.onerror = () => resolve(generateHarmonicPaletteFromUrl(imageUrl));
    img.src = imageUrl;
  });
}
