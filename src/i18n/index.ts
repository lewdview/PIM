// Interface text for the portal builds, in English and Polish. Every string the
// player reads goes through t(): the English text is the key, and pl.ts holds
// its Polish translation. Song titles, lyrics and the story's narration stay in
// English on purpose (they are th3scr1b3's writing, not interface).
//
// The language follows the device (navigator.languages) unless the player picks
// one in Options. The main site always reads English: only a portal build
// (VITE_PLATFORM=playgama) switches.
import { PL, PL_PLURALS } from './pl';

export type Lang = 'en' | 'pl';
export type LangSetting = 'auto' | Lang;
export const LANG_SETTINGS: readonly LangSetting[] = ['auto', 'en', 'pl'];

const PORTAL = import.meta.env.VITE_PLATFORM === 'playgama';
const KEY = 'opt_lang';

export function readLangSetting(): LangSetting {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'en' || v === 'pl') return v;
  } catch { /* storage blocked: follow the device */ }
  return 'auto';
}

function deviceLang(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const list = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of list) {
    const code = (l || '').toLowerCase().slice(0, 2);
    if (code === 'pl') return 'pl';
    if (code === 'en') return 'en';
  }
  return 'en';
}

function resolve(): Lang {
  if (!PORTAL) return 'en';
  const s = readLangSetting();
  return s === 'auto' ? deviceLang() : s;
}

const current: Lang = resolve();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function lang(): Lang {
  return current;
}

/**
 * Saves the player's choice and reloads, so every screen, and everything already
 * drawn on a canvas, comes back in the new language.
 */
export function setLangSetting(s: LangSetting): void {
  try {
    if (s === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, s);
  } catch { /* keep the device language */ }
  if (resolve() !== current && typeof window !== 'undefined') window.location.reload();
}

/**
 * The text in the player's language. `vars` fills {name} placeholders, in either
 * language: t('{n} of {total} cleared', { n: 3, total: 26 }).
 */
export function t(en: string, vars?: Record<string, string | number>): string {
  let s = current === 'pl' ? PL[en] ?? en : en;
  // "one|few|many": Polish plural forms, picked by {n}.
  if (s.includes('|')) {
    const forms = s.split('|');
    const n = Number(vars?.n);
    s = forms.length === 3 && Number.isFinite(n) ? forms[pluralIndex(n)] : forms[forms.length - 1];
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return s;
}

/** Polish plural form: 0 one (1), 1 few (2-4, 22-24 …), 2 many (0, 5-21, 25 …). */
function pluralIndex(n: number): 0 | 1 | 2 {
  const mod10 = n % 10, mod100 = n % 100;
  if (n === 1) return 0;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 1 : 2;
}

/**
 * A counted word in the player's language: tn(3, 'pack', 'packs'). Polish forms
 * come from PL_PLURALS in ./pl.ts, keyed by the English plural.
 */
export function tn(n: number, enOne: string, enMany: string): string {
  if (current !== 'pl') return (n === 1 ? enOne : enMany).replace('{n}', String(n));
  const forms = PL_PLURALS[enMany];
  if (!forms) return t(n === 1 ? enOne : enMany, { n });
  return forms[pluralIndex(n)].replace('{n}', String(n));
}
