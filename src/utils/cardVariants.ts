// ── 365 DAYS OF LIGHT AND DARK — CARD COVER VARIANT UTILITIES ─────────────

import dayFileMap from '../game/day_file_map.json';

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

const SUPABASE_BASE = 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/';

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
 * dynamic taglines, and dimming overlay gradients.
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

  // Dynamic Category & Day Taglines
  const CATEGORY_TAGLINES: Record<string, string> = {
    free: 'DAILY 365 RELEASES • DAY 1 TO 365',
    bombshell: '365 DAYS OF LIGHT & DARK • BOMBSHELL',
    taste: '365 DAYS OF MUSIC • ALL TRACKS',
    light: '365 DAYS OF LIGHT • SUNLIGHT MOOD',
    dark: '365 DAYS OF DARK • NIGHTFALL MOOD',
    miss_out: '365 UNCLAIMED DROPS • ARCHIVE RECOVERY',
    month: '365 MONTHLY CHAPTER • FULL ALBUM PULL',
    special_picks: '365 CURATED PICKS • RARE & MYTHIC',
    prophecy: '365 PROPHECY • PROOF OF FIRST (1/1)',
    alpha: '365 ALPHA • ARCHIVAL HEARD FIRST',
    vault_token: '365 VAULT PACK • TOKEN HOLDER',
    targeted_pull: '365 TARGETED DAY PULL • CHOOSE DAY',
    rarity_upgrade: '365 FORGE • UPGRADE CARD',
  };

  let tagline = CATEGORY_TAGLINES[String(dayOrId)] || '365 DAYS OF LIGHT AND DARK';
  if (typeof dayOrId === 'number') {
    if (mode === 'light') tagline = `DAY ${dayNum} // 365 DAYS OF LIGHT`;
    else if (mode === 'dark') tagline = `DAY ${dayNum} // 365 DAYS OF DARK`;
    else tagline = `DAY ${dayNum} OF 365 // LIGHT AND DARK`;
  }

  // Filters & overlays
  let filterClass = 'brightness-85 contrast-125 saturate-110';
  let overlayGradient = 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.85) 100%)';
  let accentColor = '#00E5FF';
  let isLight = false;
  let dimAmount = 0.3;

  switch (mode) {
    case 'dimmed':
      filterClass = 'brightness-75 contrast-130 saturate-115';
      overlayGradient = 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.85) 100%)';
      accentColor = dayNum % 2 === 0 ? '#ff3800' : '#00E5FF';
      isLight = false;
      dimAmount = 0.4;
      break;

    case 'dark':
      filterClass = 'brightness-65 contrast-135 saturate-105';
      overlayGradient = 'radial-gradient(circle at 50% 35%, rgba(10,5,25,0.2), rgba(0,0,0,0.88))';
      accentColor = '#FF1493';
      isLight = false;
      dimAmount = 0.5;
      break;

    case 'light':
      filterClass = 'brightness-110 contrast-115 saturate-125';
      overlayGradient = 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.8) 100%)';
      accentColor = '#FFB800';
      isLight = true;
      dimAmount = 0.2;
      break;

    case 'vivid':
      filterClass = 'brightness-95 contrast-130 saturate-160';
      overlayGradient = 'radial-gradient(ellipse at 50% 50%, rgba(0,229,255,0.2), rgba(0,0,0,0.85))';
      accentColor = '#39FF14';
      isLight = false;
      dimAmount = 0.25;
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
 * Returns a verified cover artwork URL for any day (1..365) or pack category
 */
export function getPackCoverFallback(dayOrCategory: number | string): string {
  let dayNum = 1;
  if (typeof dayOrCategory === 'number') {
    dayNum = Math.max(1, Math.min(365, dayOrCategory));
  } else {
    // Map specific pack categories to representative days 1..365
    const CATEGORY_DAY_MAP: Record<string, number> = {
      free: 1,
      bombshell: 50,
      taste: 100,
      light: 180,
      dark: 250,
      miss_out: 300,
      month: 365,
      special_picks: 77,
      prophecy: 111,
      alpha: 222,
      vault_token: 333,
      targeted_pull: 150,
      rarity_upgrade: 200,
    };
    dayNum = CATEGORY_DAY_MAP[String(dayOrCategory)] || 1;
  }

  const mapped = (dayFileMap as any)[String(dayNum)];
  if (mapped && mapped.cover) {
    return SUPABASE_BASE + encodeURIComponent(mapped.cover).replace(/%2F/g, '/');
  }

  return 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/covers/january/01%20-%20Were%20Going%20Crazy%20World.jpg';
}

/**
 * Resolves 3 to 4 distinct verified cover artwork URLs from day_file_map.json
 * to create a rich multi-cover collage/fan on pack backgrounds.
 */
export function getPackMultiCovers(dayOrCategory: number | string, count: number = 3): string[] {
  let seed = 1;
  if (typeof dayOrCategory === 'number') {
    seed = Math.max(1, Math.min(365, dayOrCategory));
  } else {
    let hash = 0;
    for (let i = 0; i < String(dayOrCategory).length; i++) {
      hash = (hash << 5) - hash + String(dayOrCategory).charCodeAt(i);
      hash |= 0;
    }
    seed = (Math.abs(hash) % 365) + 1;
  }

  const result: string[] = [];
  const totalDays = 365;

  for (let i = 0; i < count; i++) {
    const step = Math.floor(totalDays / count);
    const day = ((seed + i * step + Math.floor(seededRandom(seed + i * 7) * 40)) % totalDays) + 1;
    const mapped = (dayFileMap as any)[String(day)];
    if (mapped && mapped.cover) {
      result.push(SUPABASE_BASE + encodeURIComponent(mapped.cover).replace(/%2F/g, '/'));
    } else {
      result.push('https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/covers/january/01%20-%20Were%20Going%20Crazy%20World.jpg');
    }
  }

  return result;
}
