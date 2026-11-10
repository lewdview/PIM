// The 365 ecosystem pill (<th3-ecosystem-bar>, loaded from th3scr1b3.art/ecosystem-bar.js in
// index.html) renders "◐ 365 ↑". On PIM it collides with page buttons on phones, so we
// trim it to just the light/dark mark. The bar re-renders its shadow DOM on every route
// change, which wipes injected <style> tags; adoptedStyleSheets survive that.
const ICON_ONLY_CSS = `
.pill { width: 40px; height: 40px; padding: 0; gap: 0; justify-content: center; }
.pill .mark { width: 16px; height: 16px; }
.pill > span:nth-of-type(2) {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap;
}
.pill > span:nth-of-type(3) { display: none; }
`;

function patch(host: Element): boolean {
  const root = (host as HTMLElement).shadowRoot;
  if (!root || !('adoptedStyleSheets' in root)) return false;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(ICON_ONLY_CSS);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return true;
  } catch {
    return false;
  }
}

export function initEcosystemBar() {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector('th3-ecosystem-bar');
  if (existing && patch(existing)) return;
  // The script is deferred and appends its host to <body> when it mounts.
  const obs = new MutationObserver(() => {
    const host = document.querySelector('th3-ecosystem-bar');
    if (host && patch(host)) obs.disconnect();
  });
  obs.observe(document.body, { childList: true });
  window.setTimeout(() => obs.disconnect(), 30000);
}
