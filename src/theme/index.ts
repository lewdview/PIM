// Light and dark theme for the portal builds (the main site stays dark).
//
// The theme follows the device (prefers-color-scheme) unless the player picks one
// in Options. It is applied as <html data-theme="light|dark">; the light look
// lives in src/styles/themeLight.css. Songs, results, story scenes, listening mode
// and Beat Runner keep their dark stage in both themes (setDarkStage): the light
// theme is for the menus.

export type Theme = 'light' | 'dark';
export type ThemeSetting = 'auto' | Theme;
export const THEME_SETTINGS: readonly ThemeSetting[] = ['auto', 'light', 'dark'];

const PORTAL = import.meta.env.VITE_PLATFORM === 'playgama';
const KEY = 'opt_theme';
const listeners = new Set<(t: Theme) => void>();

export function readThemeSetting(): ThemeSetting {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* storage blocked: follow the device */ }
  return 'auto';
}

function media(): MediaQueryList | null {
  return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
}

function resolve(): Theme {
  if (!PORTAL) return 'dark';
  const s = readThemeSetting();
  if (s !== 'auto') return s;
  return media()?.matches ? 'light' : 'dark';
}

let current: Theme = 'dark';
let stage = false;

function apply(): void {
  current = resolve();
  const shown: Theme = stage ? 'dark' : current;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = shown;
    document.documentElement.style.colorScheme = shown;
  }
  listeners.forEach((fn) => fn(current));
}

export function theme(): Theme {
  return current;
}

export function setThemeSetting(s: ThemeSetting): void {
  try {
    if (s === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, s);
  } catch { /* keep following the device */ }
  apply();
}

/**
 * Songs, results, story and ending scenes, listening mode and Beat Runner are a
 * dark stage in both themes: the shell calls this when the player enters or
 * leaves one.
 */
export function setDarkStage(on: boolean): void {
  if (on === stage) return;
  stage = on;
  apply();
}

export function onThemeChange(fn: (t: Theme) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

apply();
media()?.addEventListener?.('change', () => { if (readThemeSetting() === 'auto') apply(); });
