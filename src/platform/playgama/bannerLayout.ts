// Advanced banner slots for the `menu` placement (chapter and results screens).
// vite.config.ts writes these into playgama-bridge-config.json, and bridge.ts
// reads them to reserve the same space: on playgama.com and in the QA tool the
// portal draws the banners over our iframe, so there is nothing in our page to
// measure. Sizes are % of the game window; keys use Bridge's match syntax.

export interface BannerSlot { width: string; height: string; top?: string; bottom?: string; left?: string; right?: string }

export const MENU_BANNERS: Record<string, BannerSlot[]> = {
  // A rail down the right of a wide screen.
  'landscape:w>=1000:h>=560': [{ width: '16%', height: '100%', top: '0', right: '0' }],
  // A strip along the bottom of a tall portrait one. None on small or sideways phones.
  'portrait:h>=700': [{ width: '100%', height: '9%', bottom: '0', left: '0' }],
};

function matches(rule: string, w: number, h: number): boolean {
  return rule.split(':').every((part) => {
    if (part === 'landscape') return w >= h;
    if (part === 'portrait') return h > w;
    const m = /^([wh])(>=|<=|>|<)(\d+)$/.exec(part);
    if (!m) return true; // device type and other keys we don't model
    const v = m[1] === 'w' ? w : h;
    const n = Number(m[3]);
    return m[2] === '>=' ? v >= n : m[2] === '<=' ? v <= n : m[2] === '>' ? v > n : v < n;
  });
}

/** Space the configured slots take at this window size, in px. */
export function menuBannerSpace(w: number, h: number): { right: number; bottom: number } {
  let right = 0;
  let bottom = 0;
  const rule = Object.keys(MENU_BANNERS).find((k) => matches(k, w, h));
  for (const s of rule ? MENU_BANNERS[rule] : []) {
    const pw = (parseFloat(s.width) / 100) * w;
    const ph = (parseFloat(s.height) / 100) * h;
    if (s.right === '0' && ph >= h * 0.99) right = Math.max(right, pw);
    else if (s.bottom === '0') bottom = Math.max(bottom, ph);
  }
  return { right, bottom };
}
