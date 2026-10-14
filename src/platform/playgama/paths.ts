/**
 * Playgama serves the uploaded archive from a sub-path of its own host, but the
 * app (and its JSON catalogs) address public files from the site root
 * ("/data/…", "/audio/…"). In the Playgama build we detect the folder that
 * index.html was opened from and prefix root-absolute src/fetch URLs with it.
 * On the regular web build APP_BASE is '' and nothing is patched.
 */
const IS_PLAYGAMA = import.meta.env.VITE_PLATFORM === 'playgama';

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
  if (installed || !APP_BASE) return;
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
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    nativeFetch(typeof input === 'string' ? appUrl(input) : input, init)) as typeof window.fetch;

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    return (nativeOpen as (...a: unknown[]) => void).call(this, method, typeof url === 'string' ? appUrl(url) : url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  for (const proto of [
    HTMLImageElement.prototype,
    HTMLMediaElement.prototype,
    HTMLSourceElement.prototype,
    HTMLScriptElement.prototype,
  ]) {
    patchSetter(proto, 'src', appUrl);
  }
  patchSetter(HTMLVideoElement.prototype, 'poster', appUrl);

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
    const n = name.toLowerCase();
    if ((n === 'src' || n === 'poster') && typeof value === 'string') value = appUrl(value);
    return nativeSetAttribute.call(this, name, value);
  };

  // `new Audio(url)` sets src natively, bypassing the setter above.
  const NativeAudio = window.Audio;
  const PatchedAudio = function (this: unknown, src?: string) {
    return src === undefined ? new NativeAudio() : new NativeAudio(appUrl(src));
  } as unknown as typeof Audio;
  PatchedAudio.prototype = NativeAudio.prototype;
  window.Audio = PatchedAudio;
}
