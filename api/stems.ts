/**
 * POST /api/stems { cardId } with the player's Supabase access token: the Mythic stems claim.
 *
 * claim_mythic_stems (Supabase) checks that the caller owns that vault card and that it is
 * Mythic, records the claim, and returns the card's day. We answer with the download URL
 * for that day's stems archive. The archive location stays server-side (STEMS_BASE_URL),
 * and when STEMS_SIGNING_SECRET is set the URL carries an expiring HMAC so the file host
 * can refuse links that did not come from here.
 *
 *   STEMS_BASE_URL       default https://files.th3scr1b3.art/stems  -> <base>/<day>
 *   STEMS_SIGNING_SECRET optional; adds ?exp=<unix>&sig=<hex hmac-sha256 of "<day>:<exp>">
 *   STEMS_LINK_TTL       seconds a signed link stays valid, default 900
 */
export const config = { runtime: 'edge' };

const env = (k: string) => (typeof process !== 'undefined' ? process.env[k] : undefined);

const SUPABASE_URL = env('SUPABASE_URL') || env('VITE_SUPABASE_URL') || '';
const SUPABASE_KEY = env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY') || '';
const STEMS_BASE_URL = (env('STEMS_BASE_URL') || 'https://files.th3scr1b3.art/stems').replace(/\/+$/, '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

async function sign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!SUPABASE_URL || !SUPABASE_KEY) return json({ error: 'Stems are not configured.' }, 500);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in to claim stems.' }, 401);

  const body = await req.json().catch(() => null) as { cardId?: string } | null;
  const cardId = body?.cardId;
  if (!cardId || !UUID.test(cardId)) return json({ error: 'Pick a Mythic card from your vault.' }, 400);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_mythic_stems`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_collection_id: cardId }),
  });
  const data = await res.json().catch(() => null) as { day?: number; message?: string } | null;
  if (!res.ok || !data?.day) {
    const status = res.status === 401 ? 401 : res.status >= 500 ? 502 : 403;
    return json({ error: data?.message || 'Could not claim stems for this card.' }, status);
  }

  const day = data.day;
  const url = new URL(`${STEMS_BASE_URL}/${day}`);
  const secret = env('STEMS_SIGNING_SECRET');
  if (secret) {
    const exp = Math.floor(Date.now() / 1000) + (Number(env('STEMS_LINK_TTL')) || 900);
    url.searchParams.set('exp', String(exp));
    url.searchParams.set('sig', await sign(`${day}:${exp}`, secret));
  }
  return json({ url: url.toString(), day, filename: `th3scr1b3-day-${String(day).padStart(3, '0')}-stems` });
}
