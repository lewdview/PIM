// ── 365 DAYS OF LIGHT AND DARK — CARD COVER VARIANT UTILITIES ─────────────

export type CoverVariantMode = 'dimmed' | 'dark' | 'light' | 'vivid' | 'monochrome' | 'high_contrast';

export interface CardVariantConfig {
  day: number;
  mode: CoverVariantMode;
  tagline: string;
  imgScale: string;
  filterClass: string;
  overlayGradient: string;
  accentColor: string;
  isLight: boolean;
  dimAmount: number; // 0.0 (bright) to 0.8 (deeply dimmed)
}

/**
 * Deterministic pseudo-random number generator for day seed 1..365
 */
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/**
 * Computes a deterministic cover variant configuration for any given day (1..365)
 * or pack ID, providing light/dark contrast variations, blown up centered scaling,
 * and dimming overlay gradients.
 */
export function get365CardVariantStyle(dayOrId: number | string): CardVariantConfig {
  let dayNum = 1;
  if (typeof dayOrId === 'number') {
    dayNum = Math.max(1, Math.min(365, dayOrId));
  } else {
    // Hash string ID to integer 1..365
    let hash = 0;
    for (let i = 0; i < dayOrId.length; i++) {
      hash = (hash << 5) - hash + dayOrId.charCodeAt(i);
      hash |= 0;
    }
    dayNum = (Math.abs(hash) % 365) + 1;
  }

  const r1 = seededRandom(dayNum * 1.3);
  const r2 = seededRandom(dayNum * 3.7);
  const r3 = seededRandom(dayNum * 7.1);

  // Variant Mode Distribution:
  // ~35% dimmed, ~25% dark, ~25% light, ~15% vivid
  let mode: CoverVariantMode = 'dimmed';
  if (r1 < 0.35) mode = 'dimmed';
  else if (r1 < 0.60) mode = 'dark';
  else if (r1 < 0.85) mode = 'light';
  else mode = 'vivid';

  // Scale variants: blown up and centered
  const scales = ['scale-110', 'scale-120', 'scale-130', 'scale-140'];
  const imgScale = scales[Math.floor(r2 * scales.length)] + ' object-center';

  // Taglines
  let tagline = '365 DAYS OF LIGHT AND DARK';
  if (mode === 'light') tagline = '365 DAYS OF LIGHT';
  else if (mode === 'dark') tagline = '365 DAYS OF DARK';
  else if (r3 > 0.5) tagline = `DAY ${dayNum} // LIGHT & DARK`;

  // Filters & overlays
  let filterClass = 'brightness-75 contrast-125 saturate-110';
  let overlayGradient = 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.92) 100%)';
  let accentColor = '#00E5FF';
  let isLight = false;
  let dimAmount = 0.4;

  switch (mode) {
    case 'dimmed':
      filterClass = 'brightness-55 contrast-135 saturate-105';
      overlayGradient = 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.92) 100%)';
      accentColor = dayNum % 2 === 0 ? '#ff3800' : '#00E5FF';
      isLight = false;
      dimAmount = 0.55;
      break;

    case 'dark':
      filterClass = 'brightness-40 contrast-145 saturate-90';
      overlayGradient = 'radial-gradient(circle at 50% 35%, rgba(10,5,25,0.3), rgba(0,0,0,0.95))';
      accentColor = '#FF1493';
      isLight = false;
      dimAmount = 0.70;
      break;

    case 'light':
      filterClass = 'brightness-105 contrast-110 saturate-125';
      overlayGradient = 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.88) 100%)';
      accentColor = '#FFB800';
      isLight = true;
      dimAmount = 0.25;
      break;

    case 'vivid':
      filterClass = 'brightness-90 contrast-130 saturate-160';
      overlayGradient = 'radial-gradient(ellipse at 50% 50%, rgba(0,229,255,0.2), rgba(0,0,0,0.9))';
      accentColor = '#39FF14';
      isLight = false;
      dimAmount = 0.35;
      break;
  }

  return {
    day: dayNum,
    mode,
    tagline,
    imgScale,
    filterClass,
    overlayGradient,
    accentColor,
    isLight,
    dimAmount,
  };
}

/**
 * Returns a fallback cover artwork URL if none is provided
 */
export function getPackCoverFallback(dayOrCategory: number | string): string {
  if (typeof dayOrCategory === 'number') {
    const day = Math.max(1, Math.min(365, dayOrCategory));
    return `/data/covers/day-${day}.jpg`;
  }
  
  // Default pack cover graphics
  const FALLBACKS: Record<string, string> = {
    free: '/data/covers/day-1.jpg',
    bombshell: '/data/covers/day-50.jpg',
    taste: '/data/covers/day-100.jpg',
    light: '/data/covers/day-180.jpg',
    dark: '/data/covers/day-250.jpg',
    miss_out: '/data/covers/day-300.jpg',
    month: '/data/covers/day-365.jpg',
    special_picks: '/data/covers/day-77.jpg',
    prophecy: '/data/covers/day-111.jpg',
    alpha: '/data/covers/day-222.jpg',
  };

  return FALLBACKS[String(dayOrCategory)] || '/data/covers/default.jpg';
}
