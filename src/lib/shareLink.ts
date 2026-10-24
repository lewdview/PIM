/**
 * Share links for a run: /s/<songId>?s=&m=&a=&c=&fc= opens the song, and link
 * previews show a card of the run (api/s.ts and api/share-image.ts).
 */
export interface ShareableRun {
  songId: string;
  title: string;
  score: number;
  medal: string;
  accuracy: number;
  maxCombo: number;
  fullCombo: boolean;
}

/** The deployed site; the desktop app and local dev serve from origins nobody else can open. */
const PUBLIC_ORIGIN = 'https://pim.th3scr1b3.art';
const shareOrigin = () =>
  window.location.protocol === 'https:' && !window.location.hostname.endsWith('localhost') ? window.location.origin : PUBLIC_ORIGIN;

export function runShareUrl(r: ShareableRun): string {
  const url = new URL(`/s/${r.songId}`, shareOrigin());
  url.searchParams.set('s', String(Math.round(r.score)));
  url.searchParams.set('m', (r.medal || 'NONE').toUpperCase());
  url.searchParams.set('a', r.accuracy.toFixed(1));
  url.searchParams.set('c', String(r.maxCombo));
  if (r.fullCombo) url.searchParams.set('fc', '1');
  return url.toString();
}

export function runShareText(r: ShareableRun): string {
  const medal = r.medal && r.medal !== 'NONE' ? `${r.medal.charAt(0)}${r.medal.slice(1).toLowerCase()} medal` : 'Cleared';
  return `${medal} on "${r.title}" in PIM: ${r.score.toLocaleString('en-US')} pts, ${r.accuracy.toFixed(1)}%${r.fullCombo ? ', full combo' : ''}. Can you beat it?`;
}

/** The device share sheet where there is one, otherwise the link is copied. */
export async function shareRun(r: ShareableRun): Promise<'shared' | 'copied' | 'failed'> {
  const url = runShareUrl(r);
  const text = runShareText(r);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'PIM', text, url });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'failed';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
