/**
 * Playgama serves the uploaded archive from a sub-path of its own host, but the
 * app (and its JSON catalogs) address public files from the site root
 * ("/data/…", "/audio/…"). In the Playgama build we detect the folder that
 * index.html was opened from and prefix root-absolute src/fetch URLs with it.
 * On the regular web build APP_BASE is '' and nothing is patched.
 *
 * A monthly build also ships its songs and art inside the archive (see
 * monthMedia.mjs): CDN URLs for those files are pointed at the bundled copies,
 * and requests to the app's own backends are refused, since a portal game may
 * not call outside services.
 */
import dayFileMap from '../../game/day_file_map.json';
import bombshellMap from '../../game/bombshell_covers_map.json';
import { monthMediaEntries } from './monthMedia.mjs';

const IS_PLAYGAMA = import.meta.env.VITE_PLATFORM === 'playgama';
const MONTH = IS_PLAYGAMA ? __PIM_MONTH__ : 0;

function detectBase(): string {
  if (!IS_PLAYGAMA || typeof window === 'undefined') return '';
  const path = window.location.pathname;
  return path.slice(0, path.lastIndexOf('/'));
}

/** Folder the game was launched from, without a trailing slash ('' at the site root). */
export const APP_BASE = detectBase();

/** Prefixes a root-absolute app path with APP_BASE. Leaves full and relative URLs alone. */
export function appUrl(url: string): string {
  if (!APP_BASE || typeof url !== 'string') return url;
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  if (url === APP_BASE || url.startsWith(APP_BASE + '/')) return url;
  return APP_BASE + url;
}

const CDN_HOST = /(^|\.)th3scr1b3\.art$/i;
// The app's own backends and web3/social services; the Bridge's hosts stay reachable.
const BLOCKED_HOST =
  /(^|\.)(th3scr1b3\.art|supabase\.co|supabase\.in|base\.org|basescan\.org|easscan\.org|blockscout\.com|warpcast\.com|walletconnect\.(com|org)|coinbase\.com|jsdelivr\.net)$/i;

let media: Map<string, string> | null = null;
function monthMedia(): Map<string, string> {
  if (!media) {
    media = new Map();
    for (const e of monthMediaEntries(MONTH, dayFileMap, bombshellMap, __PIM_BOMBSHELL__)) {
      for (const key of [e.remote, ...e.aliases]) media.set(key, e.local);
    }
  }
  return media;
}

function blockedHost(url: string): URL | null {
  if (!MONTH || !/^(https?:)?\/\//i.test(url)) return null;
  try {
    const u = new URL(url, window.location.href);
    return BLOCKED_HOST.test(u.hostname) ? u : null;
  } catch {
    return null;
  }
}

/**
 * Monthly build: a CDN media URL becomes its bundled copy; any other request to
 * a blocked host becomes a local path that 404s. Other URLs are returned as-is.
 */
export function bundledUrl(url: string): string {
  const u = typeof url === 'string' ? blockedHost(url) : null;
  if (!u) return url;
  let local: string | undefined;
  if (CDN_HOST.test(u.hostname)) {
    let key = u.pathname.replace(/^\/+/, '');
    try {
      key = decodeURIComponent(key);
    } catch { /* keep the raw path */ }
    local = monthMedia().get(key);
  }
  return `${APP_BASE}/${local ?? 'media/missing'}`;
}

/** Every URL the shim rewrites goes through here. */
function rewrite(url: string): string {
  const bundled = bundledUrl(url);
  return bundled !== url ? bundled : appUrl(url);
}

function patchSetter(proto: object | undefined, prop: string, transform: (v: string) => string) {
  if (!proto) return;
  const desc = Object.getOwnPropertyDescriptor(proto, prop);
  if (!desc?.set || !desc.get) return;
  Object.defineProperty(proto, prop, {
    ...desc,
    set(this: unknown, value: unknown) {
      desc.set!.call(this, typeof value === 'string' ? transform(value) : value);
    },
  });
}

let installed = false;

/** Installs the URL rewriting hooks. Must run before the app renders. */
export function installPathShim(): void {
  if (installed || !IS_PLAYGAMA || (!APP_BASE && !MONTH)) return;
  installed = true;

  // index.html is the entry; route the app from the folder root instead.
  if (window.location.pathname.endsWith('/index.html')) {
    window.history.replaceState(
      window.history.state,
      '',
      APP_BASE + '/' + window.location.search + window.location.hash,
    );
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const blocked = blockedHost(url);
    // Media from the CDN is bundled; anything else on a blocked host fails like being offline.
    if (blocked && !CDN_HOST.test(blocked.hostname)) return Promise.reject(new TypeError('Failed to fetch'));
    if (typeof input === 'string' || input instanceof URL) return nativeFetch(rewrite(url), init);
    return nativeFetch(rewrite(url) !== url ? new Request(rewrite(url), input) : input, init);
  }) as typeof window.fetch;

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    const target = typeof url === 'string' ? url : url.href;
    return (nativeOpen as (...a: unknown[]) => void).call(this, method, rewrite(target), ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  for (const proto of [
    HTMLImageElement.prototype,
    HTMLMediaElement.prototype,
    HTMLSourceElement.prototype,
    HTMLScriptElement.prototype,
  ]) {
    patchSetter(proto, 'src', rewrite);
  }
  patchSetter(HTMLVideoElement.prototype, 'poster', rewrite);

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
    const n = name.toLowerCase();
    if ((n === 'src' || n === 'poster') && typeof value === 'string') value = rewrite(value);
    return nativeSetAttribute.call(this, name, value);
  };

  // Inline `background-image: url(...)` can't be caught by a setter, but a
  // MutationObserver callback runs before the next style recalc, which is when
  // the browser would request the image.
  const CSS_URL = /url\((['"]?)([^'")]+)\1\)/g;
  const fixStyle = (el: Element) => {
    const style = el.getAttribute('style');
    if (!style || !style.includes('url(')) return;
    const next = style.replace(CSS_URL, (m, q: string, u: string) => {
      const r = rewrite(u);
      return r === u ? m : `url(${q}${r}${q})`;
    });
    if (next !== style) nativeSetAttribute.call(el, 'style', next);
  };
  new MutationObserver((records) => {
    for (const rec of records) {
      if (rec.type === 'attributes') fixStyle(rec.target as Element);
      else rec.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        fixStyle(n as Element);
        (n as Element).querySelectorAll('[style*="url("]').forEach(fixStyle);
      });
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });

  // `new Audio(url)` sets src natively, bypassing the setter above.
  const NativeAudio = window.Audio;
  const PatchedAudio = function (this: unknown, src?: string) {
    return src === undefined ? new NativeAudio() : new NativeAudio(rewrite(src));
  } as unknown as typeof Audio;
  PatchedAudio.prototype = NativeAudio.prototype;
  window.Audio = PatchedAudio;
}

// Installed as soon as this module loads, ahead of the app modules: some (the
// Supabase client) keep a reference to window.fetch from when they load.
installPathShim();

