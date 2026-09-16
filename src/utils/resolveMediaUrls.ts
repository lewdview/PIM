import dayFileMap from '../game/day_file_map.json';
import { STORAGE_BASE } from '../services/supabaseClient';
import { getCoverUrlForRarity } from './rarityArtwork';

export const FALLBACK_SYNTH_AUDIO = 'https://files.th3scr1b3.art/audio/day-1.mp3';
const LOCAL_BASE = '/@fs/Volumes/extremeUno/th3scr1b3-365-warp/365-releases/';

/**
 * Strips whitespace, control characters, and leading/trailing quotes.
 * Returns empty string if url is not a string.
 */
export function sanitizeMediaUrl(url: any): string {
  if (typeof url !== 'string') return '';
  return url.trim().replace(/^["']|["']$/g, '');
}

export function isUseLocalFiles(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return (
    localStorage.getItem('opt_useLocalFiles') === 'true' ||
    localStorage.getItem('useLocalFiles') === 'true' ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_USE_LOCAL_FILES === 'true')
  );
}

export interface ResolveMediaOptions {
  day: number | string;
  rawAudioUrl?: string;
  rawCoverUrl?: string;
  manifestAudioPath?: string;
  fileName?: string;
  date?: string;
  rarity?: string;
  useLocal?: boolean;
}

/**
 * Canonical URL resolution utility for songs and cards.
 * Consolidates day_file_map lookups, local filesystem vs Supabase Storage paths,
 * and rarity alternate-cover routing.
 */
export function resolveMediaUrls(opts: ResolveMediaOptions): { audioUrl: string; coverUrl: string } {
  const dayNum = typeof opts.day === 'string' ? parseInt(opts.day, 10) : (opts.day || 1);
  const dayStr = String(dayNum);
  const mapped = (dayFileMap as any)[dayStr];
  const useLocal = opts.useLocal !== undefined ? opts.useLocal : isUseLocalFiles();

  let audioUrl = opts.rawAudioUrl || '';
  let coverUrl = opts.rawCoverUrl || '';
  if (coverUrl) {
    coverUrl = coverUrl.replace(/\.png$/i, '.jpg');
  }

  const SUPABASE_BASE = STORAGE_BASE;

  if (useLocal) {
    if (mapped && mapped.audio) {
      audioUrl = LOCAL_BASE + mapped.audio;
    } else if (opts.manifestAudioPath) {
      audioUrl = LOCAL_BASE + decodeURIComponent(opts.manifestAudioPath);
    } else if (opts.fileName && opts.date) {
      const parts = opts.date.split('-');
      const monthNum = parseInt(parts[1], 10);
      const months = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
      ];
      const monthStr = months[monthNum - 1];
      audioUrl = LOCAL_BASE + `audio/${monthStr}/${decodeURIComponent(opts.fileName)}`;
    }

    if (mapped && mapped.cover) {
      coverUrl = LOCAL_BASE + mapped.cover;
    } else if (coverUrl && coverUrl.includes('/releaseready/')) {
      const parts = coverUrl.split('/releaseready/');
      if (parts.length > 1) {
        coverUrl = LOCAL_BASE + decodeURIComponent(parts[1]);
      }
    }
  } else {
    // Online mode: Correct URLs using database-storage mappings
    if (mapped) {
      if (mapped.audio) {
        const audioPath = mapped.audio.replace(/\.wav$/i, '.mp3');
        audioUrl = SUPABASE_BASE + encodeURIComponent(audioPath).replace(/%2F/g, '/');
      } else {
        audioUrl = audioUrl || FALLBACK_SYNTH_AUDIO;
      }
      if (mapped.cover) {
        coverUrl = SUPABASE_BASE + encodeURIComponent(mapped.cover).replace(/%2F/g, '/');
      }
    } else {
      audioUrl = audioUrl || FALLBACK_SYNTH_AUDIO;
    }
  }

  if (opts.rarity) {
    coverUrl = getCoverUrlForRarity(coverUrl, opts.rarity as any);
  }

  return {
    audioUrl: sanitizeMediaUrl(audioUrl),
    coverUrl: sanitizeMediaUrl(coverUrl),
  };
}
