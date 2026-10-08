/**
 * SSO redirect allow-list for the th3scr1b3 identity hub.
 *
 * Session tokens are handed to redirect targets in the URL hash, so a target
 * MUST be a first-party th3scr1b3.art origin. An unvalidated redirect_uri is
 * an open redirect that leaks tokens to an attacker's site.
 */
export function isAllowedRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    const host = url.hostname.toLowerCase();
    // Local dev only
    if (host === 'localhost' || host === '127.0.0.1') {
      return url.protocol === 'http:' || url.protocol === 'https:';
    }
    // Any th3scr1b3.art subdomain, HTTPS only
    const isFirstParty = host === 'th3scr1b3.art' || host.endsWith('.th3scr1b3.art');
    return isFirstParty && url.protocol === 'https:';
  } catch {
    return false;
  }
}
