/**
 * Live Audius data for the Audius section: th3Scr1b3's tracks and albums.
 *
 * Everything streams from Audius itself, so plays in PIM count as plays on
 * Audius. audius_map.json (from scripts/audius/sync_audius.mjs) says which
 * uploads are 365 days and which are Beyond 365; this file adds the live
 * parts: track ids for streaming, artwork and play counts.
 */
import audiusMap from '@/data/audius_map.json';
import beyondCovers from '@/data/beyond365_covers.json';
import type { GlobalTrack } from '@/store/useGlobalPlayer';

const API = 'https://api.audius.co/v1';
const APP = 'PIM';
export const AUDIUS_HANDLE = audiusMap.handle;

export interface AudiusTrack {
  id: string;
  title: string;
  permalink: string;
  url: string;
  duration: number;
  plays: number;
  artwork: string | null;
  /** The 365 day this upload is, when it is one. */
  day: number | null;
}

export interface AudiusAlbum {
  id: string;
  name: string;
  permalink: string;
  url: string;
  artwork: string | null;
  trackCount: number;
  /** The album the owner officially published. */
  published: boolean;
}

interface MapEntry {
  permalink: string;
  title: string;
  duration: number;
  day: number | null;
  status: string;
}

const mapByPermalink = new Map<string, MapEntry>(
  (audiusMap.tracks as MapEntry[]).map((t) => [t.permalink.toLowerCase(), t]),
);

/** Beyond 365 uploads, in Audius order, from the generated map. */
export const BEYOND_365: MapEntry[] = (audiusMap.tracks as MapEntry[]).filter(
  (t) => t.status === 'beyond',
);

// Album order and display names. Audius spells the published one "Afterlfe".
const ALBUMS: { match: RegExp; name: string; published?: boolean }[] = [
  { match: /^afterl/i, name: 'Afterlife', published: true },
  { match: /^that one girl/i, name: 'That One Girl' },
  { match: /^against a wall/i, name: 'Against a Wall' },
];

/** A cover the owner made for a Beyond 365 track, keyed by permalink. */
export function getBeyondCover(permalink: string): string | null {
  return (beyondCovers as Record<string, string>)[permalink] ?? null;
}

export function streamUrl(trackId: string): string {
  return `${API}/tracks/${encodeURIComponent(trackId)}/stream?app_name=${APP}`;
}

async function get<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API}${path}${sep}app_name=${APP}`);
  if (!res.ok) throw new Error(`Audius ${res.status}`);
  const body = await res.json();
  return body.data as T;
}

function toTrack(t: any): AudiusTrack {
  const permalink: string = t.permalink ?? '';
  const mapped = mapByPermalink.get(permalink.toLowerCase());
  return {
    id: t.id,
    title: t.title,
    permalink,
    url: `https://audius.co${permalink}`,
    duration: t.duration ?? 0,
    plays: t.play_count ?? 0,
    artwork: t.artwork?.['480x480'] ?? t.artwork?.['150x150'] ?? null,
    day: mapped?.status === 'matched' ? mapped.day : null,
  };
}

let tracksPromise: Promise<AudiusTrack[]> | null = null;

/** Every public th3Scr1b3 track, fetched once per session. */
export function fetchAudiusTracks(): Promise<AudiusTrack[]> {
  if (!tracksPromise) {
    tracksPromise = (async () => {
      const out: AudiusTrack[] = [];
      for (let offset = 0; offset < 1000; offset += 100) {
        const page = await get<any[]>(
          `/users/handle/${AUDIUS_HANDLE}/tracks?limit=100&offset=${offset}`,
        );
        if (!page?.length) break;
        out.push(...page.map(toTrack));
        if (page.length < 100) break;
      }
      return out;
    })().catch((err) => {
      tracksPromise = null;
      throw err;
    });
  }
  return tracksPromise;
}

let albumsPromise: Promise<AudiusAlbum[]> | null = null;

/** The three albums, published one first. */
export function fetchAudiusAlbums(): Promise<AudiusAlbum[]> {
  if (!albumsPromise) {
    albumsPromise = get<any[]>(`/users/handle/${AUDIUS_HANDLE}/albums`)
      .then((list) => {
        const albums: AudiusAlbum[] = [];
        for (const def of ALBUMS) {
          const a = (list ?? []).find((x) => def.match.test(x.playlist_name ?? ''));
          if (!a || a.is_private) continue;
          albums.push({
            id: a.id,
            name: def.name,
            permalink: a.permalink,
            url: `https://audius.co${a.permalink}`,
            artwork: a.artwork?.['480x480'] ?? a.artwork?.['150x150'] ?? null,
            trackCount: a.track_count ?? 0,
            published: Boolean(def.published),
          });
        }
        return albums;
      })
      .catch((err) => {
        albumsPromise = null;
        throw err;
      });
  }
  return albumsPromise;
}

const albumTracks = new Map<string, Promise<AudiusTrack[]>>();

export function fetchAlbumTracks(albumId: string): Promise<AudiusTrack[]> {
  let p = albumTracks.get(albumId);
  if (!p) {
    p = get<any[]>(`/playlists/${encodeURIComponent(albumId)}/tracks`)
      .then((list) => (list ?? []).filter((t) => t.is_streamable !== false).map(toTrack))
      .catch((err) => {
        albumTracks.delete(albumId);
        throw err;
      });
    albumTracks.set(albumId, p);
  }
  return p;
}

// Each Audius track gets a stable negative "day" so the global player, which
// tells tracks apart by day, never confuses one with a 365 song.
function playerKey(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return -(Math.abs(h) % 1_000_000_000) - 1;
}

export function toGlobalTrack(t: AudiusTrack, cover?: string | null): GlobalTrack {
  return {
    id: `audius-${t.id}`,
    title: t.title,
    artist: AUDIUS_HANDLE,
    audioUrl: streamUrl(t.id),
    coverUrl: cover ?? t.artwork ?? '/data/covers/default.jpg',
    day: playerKey(t.id),
    rarity: 'common',
    source: 'audius',
    externalUrl: t.url,
  };
}

export function formatPlays(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
