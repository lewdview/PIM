/**
 * Shared by the share-link endpoints: reads a run from the query string of
 * /s/<songId>?s=<score>&m=<medal>&a=<accuracy>&c=<combo>&fc=1 (built by
 * src/lib/shareLink.ts) and looks the song up in the public catalog. Every
 * value is checked, so a link can only ever show a song from the catalog and
 * plain numbers. Files starting with _ are not deployed as functions.
 */
export interface SharedRun {
  id: string;
  title: string;
  day: number;
  date: string;
  cover: string | null;
  score: number;
  medal: string;
  accuracy: number;
  combo: number;
  fullCombo: boolean;
  deluxe: boolean;
}

const MEDALS = new Set(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'NONE']);
const ID = /^day-\d{3}(_deluxe)?$/;

interface CatalogSong { id: string; title: string; day: number; date: string; coverArt: string | null }
let catalog: Promise<CatalogSong[]> | null = null;

function loadCatalog(origin: string): Promise<CatalogSong[]> {
  catalog ??= fetch(new URL('/data/song_catalog.json', origin)).then((r) => (r.ok ? r.json() : []))
    .catch(() => { catalog = null; return []; });
  return catalog;
}

const num = (v: string | null, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
};

export async function readRun(url: URL): Promise<SharedRun | null> {
  const id = url.searchParams.get('id') ?? '';
  if (!ID.test(id)) return null;
  const baseId = id.replace(/_deluxe$/, '');
  const song = (await loadCatalog(url.origin)).find((s) => s.id === baseId);
  if (!song) return null;
  const medal = (url.searchParams.get('m') ?? '').toUpperCase();
  return {
    id: baseId,
    title: song.title,
    day: song.day,
    date: song.date,
    cover: song.coverArt?.startsWith('https://') ? song.coverArt : null,
    score: Math.round(num(url.searchParams.get('s'), 99_999_999)),
    medal: MEDALS.has(medal) ? medal : 'NONE',
    accuracy: Math.round(num(url.searchParams.get('a'), 100) * 10) / 10,
    combo: Math.round(num(url.searchParams.get('c'), 99_999)),
    fullCombo: url.searchParams.get('fc') === '1',
    deluxe: id.endsWith('_deluxe'),
  };
}

export const MEDAL_COLOR: Record<string, string> = {
  PLATINUM: '#39FF14', GOLD: '#FFC21A', SILVER: '#C9D3E6', BRONZE: '#E08A45', NONE: '#00E5FF',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthOf = (date: string) => MONTHS[Number(date.split('-')[1]) - 1] ?? '';

export function headline(r: SharedRun): string {
  const medal = r.medal === 'NONE' ? 'Cleared' : `${r.medal.charAt(0)}${r.medal.slice(1).toLowerCase()}`;
  return `${medal} on "${r.title}"${r.deluxe ? ' (Deluxe)' : ''} · ${r.score.toLocaleString('en-US')}`;
}
