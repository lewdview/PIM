// HUD colours taken from the cover art. Gameplay already samples three colours from the
// cover for the lanes and notes (or uses the player's own lane colours when they have set
// some); this turns the same three into everything the in-song HUD tints: its accent
// variables, the stage and multiplier ladders and the combo colour. Each colour is first
// made readable on the HUD's dark panels, so a murky or washed-out cover still gives text
// and marks that can be seen. Warnings (misses, low shield, mines) keep their own red: they
// have to read as warnings whatever the art looks like.

export type HudArt = {
  /** The three art colours, readable on dark. accent = lane 1, cyan = lane 2, acid = lane 3. */
  accent: string;
  cyan: string;
  acid: string;
  /** Stage 1..5 colours for the progress rail and stage call-outs. */
  stage: [string, string, string, string, string];
  /** Multiplier colours for ×1..×5 and beyond (index 0 is "no multiplier"). */
  mult: [string, string, string, string, string, string];
  /** Sets --hud-accent / --hud-cyan / --hud-acid on a HUD root element. */
  vars: Record<string, string>;
};

/** The HUD's original fixed colours, used when a lane colour cannot be read. */
const FALLBACK: [string, string, string] = ['#FF1493', '#00E5FF', '#39FF14'];

type Rgb = [number, number, number];

function parse(color: string | undefined): Rgb | null {
  if (!color) return null;
  const c = color.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as Rgb;
  m = /^#([0-9a-f]{6})/i.exec(c);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as Rgb;
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

function toHex([r, g, b]: Rgb): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * Lifts a colour until it reads on the HUD's near-black panels: lightness is held between
 * 58% and 78%, and a colour that has any hue at all gets enough saturation to keep it.
 * Greys stay grey.
 */
function readable(rgb: Rgb): Rgb {
  const [h, s, l] = toHsl(rgb);
  const L = Math.max(0.58, Math.min(0.78, l));
  const S = s < 0.08 ? s : Math.max(0.6, s);
  return fromHsl(h, S, L);
}

function mix(a: Rgb, b: Rgb, k: number): Rgb {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

const WHITE: Rgb = [255, 255, 255];
let lastKey = '';
let last: HudArt | null = null;

/** HUD colours for the lane colours in play. Cheap to call every render: it caches by value. */
export function hudArt(lanes: readonly (string | undefined)[] | null | undefined): HudArt {
  const key = `${lanes?.[0]}|${lanes?.[1]}|${lanes?.[2]}`;
  if (last && key === lastKey) return last;
  const [c1, c2, c3] = [0, 1, 2].map((i) => readable(parse(lanes?.[i]) ?? parse(FALLBACK[i])!));
  const accent = toHex(c1), cyan = toHex(c2), acid = toHex(c3);
  const between = toHex(readable(mix(c3, c1, 0.5)));
  const peak = toHex(mix(c1, WHITE, 0.45));
  last = {
    accent,
    cyan,
    acid,
    stage: [cyan, acid, between, accent, peak],
    mult: ['#71717a', cyan, acid, between, accent, peak],
    vars: { '--hud-accent': accent, '--hud-cyan': cyan, '--hud-acid': acid },
  };
  lastKey = key;
  return last;
}
