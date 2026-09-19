import type { Note } from './types';
import { supabase } from '../lib/supabase';
import { STORAGE_BASE } from '../services/supabaseClient';
import { getCurrentDay } from '../utils/dayCalc';
import dayFileMap from './day_file_map.json';
import staticSongCatalog from '../data/song_catalog.json';
import { getHighScore as progGetHighScore, saveHighScore as progSaveHighScore } from './progress';
import { resolveMediaUrls } from '../utils/resolveMediaUrls';

export interface LyricsWord {
  word: string;
  start: number;
  end: number;
}

export interface Stage {
  stage: number;
  name: string;
  difficulty: string;
  startTime: number;
  endTime: number;
  noteCount: number;
}

export interface GameSong {
  id: string;
  uuid?: string;
  day: number;
  date: string;
  title: string;
  artist: string;
  bpm: number;
  duration: number;
  mood: 'light' | 'dark';
  valence: number;
  moodTags: string[];
  description: string;
  audioUrl: string;
  coverArt: string | null;
  notes: Note[];
  stages?: Stage[];
  key: string;
  genre: string[];
  difficultyLevel: number;
  unlock?: {
    card: string;
    fragments: number;
  };
  lyrics?: string;
  lyricsSegments?: any[];
  timingProfile?: 'standard' | 'elite';
  deluxe?: boolean;
}

/** True if the song's release date is still in the future (not yet playable). */
export function isSongTimeLocked(song: GameSong): boolean {
  try {
    const currentDay = getCurrentDay();
    if (song.day <= currentDay) {
      return false;
    }
  } catch (e) {
    console.warn('[isSongTimeLocked] dayCalc error, falling back to date string comparison:', e);
  }

  // Task 3C: Validate ISO YYYY-MM-DD date format before lexicographic string comparison
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!song.date || !ISO_DATE_RE.test(song.date)) {
    console.warn('[isSongTimeLocked] Non-ISO date format, defaulting to unlocked:', song.date);
    return false;
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return song.date > todayStr;
}

let catalogCache: GameSong[] | null = null;
let loadingPromise: Promise<GameSong[]> | null = null;

export function clearCatalogCache() {
  catalogCache = null;
  loadingPromise = null;
}

/** Estimate difficulty level from BPM and valence (matches split_songs.mjs calcDifficulty). */
function calcDifficulty(bpm: number, valence: number, noteCount: number, duration: number): number {
  const bpmNorm = (bpm - 80) / 100;
  const bpmScore = Math.min(10, Math.max(1, Math.round(1 + 9 * Math.max(0, Math.min(1, bpmNorm)))));
  const nps = noteCount / Math.max(30, duration);
  const densityScore = Math.min(10, Math.max(1, Math.round(nps * 3.5)));
  const valenceBoost = valence < 0.35 ? 1 : valence > 0.7 ? -1 : 0;
  const raw = (bpmScore * 0.4 + densityScore * 0.5) + valenceBoost;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

/** Config toggle for static vs runtime stage partitioning (Item 14) */
export const STAGEIFICATION_CONFIG = {
  USE_RUNTIME_STAGEIFICATION: false, // Default: preserve pre-baked static JSON stage definitions
  STAGE_DENSITY_MULTIPLIER: 1.0,
};

// Fallback synthetic audio loop for missing song files (Item 9)
const FALLBACK_SYNTH_AUDIO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export function sanitizeMediaUrl(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
  try {
    let rewritten = url.replace(/^(https?:\/\/)(?!files\.)th3scr1b3\.art\//i, '$1files.th3scr1b3.art/');
    const decoded = decodeURIComponent(rewritten);
    return encodeURI(decoded).replace(/\+/g, '%2B');
  } catch {
    return url;
  }
}

export function getCandidateAudioUrls(primaryUrl: string, day?: number): string[] {
  const list: string[] = [];
  const dayNum = typeof day === 'number' ? day : 0;
  const mapped = dayNum ? (dayFileMap as any)[String(dayNum)] : null;

  // 1. Prioritize fast streaming MP3 from CDN (https://files.th3scr1b3.art/)
  if (mapped && mapped.audio) {
    const mp3Path = mapped.audio.replace(/\.wav$/i, '.mp3');
    const mp3CdnUrl = `https://files.th3scr1b3.art/${encodeURIComponent(mp3Path).replace(/%2F/g, '/')}`;
    list.push(sanitizeMediaUrl(mp3CdnUrl));
    const wavCdnUrl = `https://files.th3scr1b3.art/${encodeURIComponent(mapped.audio).replace(/%2F/g, '/')}`;
    list.push(sanitizeMediaUrl(wavCdnUrl));
  }

  // 2. If primaryUrl provided, derive CDN version
  if (primaryUrl) {
    if (primaryUrl.includes('/audio/')) {
      const subPath = primaryUrl.split('/audio/')[1];
      if (subPath) {
        const decoded = decodeURIComponent(subPath);
        const mp3SubPath = decoded.replace(/\.wav$/i, '.mp3');
        const cdnUrl = `https://files.th3scr1b3.art/audio/${encodeURIComponent(mp3SubPath).replace(/%2F/g, '/')}`;
        const sanitizedCdn = sanitizeMediaUrl(cdnUrl);
        if (!list.includes(sanitizedCdn)) list.push(sanitizedCdn);
      }
    }
    const sanitizedPrimary = sanitizeMediaUrl(primaryUrl);
    if (!list.includes(sanitizedPrimary)) list.push(sanitizedPrimary);
  }

  // 3. Fallback candidates for special cases (e.g. Tightrope)
  if (dayNum === 22 || (primaryUrl && primaryUrl.toLowerCase().includes('tightrope'))) {
    const tightropeCandidates = [
      `https://files.th3scr1b3.art/audio/january/22%20-%20Tightrope%2B.mp3`,
      `https://files.th3scr1b3.art/audio/january/22%20-%20Tightrope.mp3`,
      `https://files.th3scr1b3.art/audio/january/tightrope%2B_2_mastered.mp3`,
      `https://files.th3scr1b3.art/audio/january/22%20-%20Tightrope%2B.wav`,
    ];
    for (const c of tightropeCandidates) {
      const sanitized = sanitizeMediaUrl(c);
      if (!list.includes(sanitized)) {
        list.push(sanitized);
      }
    }
  }

  return list;
}

// Helper to resolve URLs dynamically (Task 2B: shared utility)
function resolveSongUrls(song: any, useLocal = false): GameSong {
  const { audioUrl, coverUrl } = resolveMediaUrls({
    day: song.day,
    rawAudioUrl: song.audioUrl,
    rawCoverUrl: song.coverArt,
    manifestAudioPath: song.manifestAudioPath,
    useLocal,
  });

  return {
    ...song,
    audioUrl,
    coverArt: coverUrl,
  };
}

export async function loadCatalog(): Promise<GameSong[]> {
  if (catalogCache) return catalogCache;
  if (loadingPromise) return loadingPromise;

  const promise = (async (): Promise<GameSong[]> => {
    try {
      const useLocal = (typeof localStorage !== 'undefined' && (localStorage.getItem('opt_useLocalFiles') === 'true' || localStorage.getItem('useLocalFiles') === 'true')) || 
                       (import.meta.env && import.meta.env.VITE_USE_LOCAL_FILES === 'true');

      // Create static stage & metadata lookup map
      const staticMap = new Map<number, any>();
      if (Array.isArray(staticSongCatalog)) {
        for (const item of staticSongCatalog) {
          if (item && item.day) {
            staticMap.set(item.day, item);
          }
        }
      }

      // 1. Try Supabase first if configured and not forcing local
      if (supabase && !useLocal) {
        const { data, error } = await supabase
          .from('releases')
          .select('*')
          .eq('status', 'released')
          .order('day', { ascending: true });

        if (!error && data && data.length > 0) {
          console.log('Fetched catalog from Supabase');
          catalogCache = data.map((r) => {
            const staticItem = staticMap.get(r.day);
            const canonicalId = r.day ? `day-${String(r.day).padStart(3, '0')}` : r.id;
            return resolveSongUrls({
              id: canonicalId,
              uuid: r.id,
              day: r.day,
              date: r.date,
              title: r.title || r.canonicalTitle || staticItem?.title || `Day ${r.day}`,
              artist: 'TH3SCR1B3',
              bpm: r.tempo || staticItem?.bpm || 100,
              duration: Math.ceil(r.duration || staticItem?.duration || 180),
              mood: r.mood === 'light' ? 'light' : 'dark',
              valence: r.valence ?? staticItem?.valence ?? 0.5,
              moodTags: Array.isArray(r.tags) ? r.tags.slice(0, 3) : (staticItem?.moodTags || []),
              description: r.description || staticItem?.description || '',
              audioUrl: r.storedAudioUrl || staticItem?.audioUrl,
              coverArt: r.coverArt || staticItem?.coverArt || null,
              notes: staticItem?.notes || [],
              stages: staticItem?.stages || [],
              key: r.key || staticItem?.key || '',
              genre: Array.isArray(r.genre) ? r.genre : (staticItem?.genre || []),
              difficultyLevel: calcDifficulty(r.tempo || staticItem?.bpm || 100, r.valence ?? staticItem?.valence ?? 0.5, 0, Math.ceil(r.duration || staticItem?.duration || 180)),
              unlock: {
                card: `card-${r.day}`,
                fragments: 10
              }
            }, false);
          });
          return catalogCache;
        }
        if (error) console.error('Supabase fetch error:', error);
      }

      // 2. Load from local static catalog file
      let catalog: any[] = [];
      try {
        const r = await fetch('/data/song_catalog.json');
        if (r.ok) {
          catalog = await r.json();
        }
      } catch {}

      if (!catalog || !Array.isArray(catalog) || catalog.length === 0) {
        catalog = staticSongCatalog as any[];
      }

      console.log(`Fetched catalog from song_catalog.json fallback (useLocal: ${useLocal})`);
      catalogCache = catalog.map((s: any) => resolveSongUrls(s, useLocal));
      return catalogCache;
    } catch (err) {
      console.error('Failed to load catalog, using direct static fallback:', err);
      catalogCache = (staticSongCatalog as any[]).map((s: any) => resolveSongUrls(s, false));
      return catalogCache;
    }
  })();

  loadingPromise = promise;
  return promise;
}

export async function getSongById(id: string): Promise<GameSong | null> {
  const catalog = await loadCatalog();
  let basicSong = catalog.find((s) => s.id === id || (s as any).uuid === id);

  if (!basicSong) {
    const match = id.match(/\d+/);
    if (match) {
      const dayNum = parseInt(match[0], 10);
      basicSong = catalog.find((s) => s.day === dayNum);
    }
  }

  if (!basicSong) {
    // Check for tutorial / special IDs
    if (['transmission-001', 'signal-rising', 'break-of-light'].includes(id)) {
      basicSong = {
        id,
        day: 0,
        date: '2026-01-01',
        title: id === 'transmission-001' ? 'TRANSMISSION 001' : id === 'signal-rising' ? 'SIGNAL RISING' : 'BR34K OF LIGHT',
        artist: 'TH3SCR1B3',
        bpm: id === 'transmission-001' ? 82 : id === 'signal-rising' ? 120 : 145,
        duration: 95,
        mood: 'light',
        valence: 0.5,
        moodTags: ['ambient'],
        description: 'Tutorial Transmission Track',
        audioUrl: '',
        coverArt: null,
        notes: [],
        key: 'C major',
        genre: ['Electronic'],
        difficultyLevel: id === 'transmission-001' ? 3 : id === 'signal-rising' ? 6 : 9,
      };
    }
  }

  if (!basicSong) return null;

  try {
    const useLocal = (typeof localStorage !== 'undefined' && (localStorage.getItem('opt_useLocalFiles') === 'true' || localStorage.getItem('useLocalFiles') === 'true')) || 
                     (import.meta.env && import.meta.env.VITE_USE_LOCAL_FILES === 'true');

    // Robust fetchId resolution for all 365 days and special tutorial tracks
    let fetchId = '';
    if (basicSong.day && basicSong.day >= 1 && basicSong.day <= 365) {
      fetchId = `day-${String(basicSong.day).padStart(3, '0')}`;
    } else if (['transmission-001', 'signal-rising', 'break-of-light'].includes(basicSong.id)) {
      fetchId = basicSong.id;
    } else if (basicSong.id.startsWith('day-')) {
      fetchId = basicSong.id;
    } else if (basicSong.day) {
      fetchId = `day-${String(basicSong.day).padStart(3, '0')}`;
    } else {
      fetchId = basicSong.id;
    }

    const isChartEditionsUnlocked = typeof localStorage !== 'undefined' && localStorage.getItem('opt_unlocked_chart_editions') === 'true';
    const rawVariant = typeof localStorage !== 'undefined' ? (localStorage.getItem('opt_chartVariant') || 'v1_gimmicks') : 'v1_gimmicks';
    const variant = isChartEditionsUnlocked ? rawVariant : 'v1_gimmicks';
    const isDeluxeRequested = typeof localStorage !== 'undefined' && (localStorage.getItem('opt_deluxeChart') === 'true' || localStorage.getItem('opt_deluxeMode') === 'true');
    const isExplicitDeluxe = id.endsWith('_deluxe') || fetchId.endsWith('_deluxe');
    const shouldUseDeluxe = isExplicitDeluxe || (variant === 'v5_flagship' && isDeluxeRequested);

    const cleanFetchId = fetchId.replace(/_deluxe$/, '');
    let fetchUrl = `/data/songs_variants/v1_gimmicks/${cleanFetchId}.json`;

    if (variant === 'v4_neural') {
      fetchUrl = `/data/songs_variants/v4_neural/${cleanFetchId}.json`;
    } else if (variant === 'v1_gimmicks') {
      fetchUrl = `/data/songs_variants/v1_gimmicks/${cleanFetchId}.json`;
    } else if (variant === 'v2_minimal') {
      fetchUrl = `/data/songs_variants/v2_minimal/${cleanFetchId}.json`;
    } else if (variant === 'v3_master') {
      fetchUrl = `/data/songs_variants/v3_master/${cleanFetchId}.json`;
    } else if (variant === 'canonical' || variant === 'default') {
      fetchUrl = `/data/songs/${cleanFetchId}.json`;
    } else if (variant === 'v5_flagship') {
      fetchUrl = shouldUseDeluxe
        ? `/data/songs_variants/v5_flagship/${cleanFetchId}_deluxe.json`
        : `/data/songs_variants/v5_flagship/${cleanFetchId}.json`;
    }

    let res = await fetch(fetchUrl);
    if (!res.ok && shouldUseDeluxe) {
      // Fallback to standard v5_flagship if deluxe not found
      res = await fetch(`/data/songs_variants/v5_flagship/${cleanFetchId}.json`);
    }
    if (!res.ok && fetchUrl !== `/data/songs/${cleanFetchId}.json`) {
      // Fallback to default canonical chart if variant not found
      res = await fetch(`/data/songs/${cleanFetchId}.json`);
    }
    if (!res.ok) throw new Error(`Failed to fetch song detail for ${cleanFetchId}`);
    const fullDetail = await res.json();

    return resolveSongUrls({
      ...basicSong,
      ...fullDetail,
      stages: (fullDetail.stages && fullDetail.stages.length > 0) ? fullDetail.stages : (basicSong.stages || []),
      notes: (fullDetail.notes && fullDetail.notes.length > 0) ? fullDetail.notes : (basicSong.notes || []),
    }, useLocal);
  } catch (err) {
    console.error(`Failed to load full song detail for ${id}:`, err);
    return basicSong;
  }
}

export function getHighScore(songId: string): number {
  return progGetHighScore(songId);
}

export function saveHighScore(songId: string, score: number, accuracy = 0, maxCombo = 0, medal = 'NONE', telemetry?: any): void {
  progSaveHighScore(songId, score, accuracy, maxCombo, medal, telemetry);
}

export type SongModifierType = 'vocal_isolation' | 'bass_realm' | 'corrupted_signal' | 'none';

export function getModifierForSong(song: GameSong | null): SongModifierType {
  if (!song) return 'none';

  const titleLower = song.title?.toLowerCase() || '';
  const tags = (song.moodTags ?? song.tags ?? []).map((t: string) => t.toLowerCase());
  const genres = (song.genre ?? []).map((g: string) => g.toLowerCase());
  const bpm = song.bpm ?? 0;

  // 1. Explicit title cues / mood tags always win
  if (
    titleLower.includes('crash') ||
    titleLower.includes('overflow') ||
    titleLower.includes('fault') ||
    titleLower.includes('decay') ||
    tags.some(t => ['glitch', 'noise', 'corrupted', 'industrial', 'distorted'].includes(t))
  ) {
    return 'corrupted_signal';
  }

  if (tags.some(t => ['vocal', 'chill', 'ambient', 'acoustic', 'melodic', 'emotional', 'ballad'].includes(t))) {
    return 'vocal_isolation';
  }

  if (tags.some(t => ['intense', 'heavy', 'bass', 'hardcore', 'dark', 'synthwave', 'techno', 'rave'].includes(t))) {
    return 'bass_realm';
  }

  // 2. Genre classification
  if (genres.some(g => ['pop', 'indie', 'acoustic', 'r&b', 'soul', 'folk', 'ambient', 'classical'].includes(g))) {
    return 'vocal_isolation';
  }

  if (genres.some(g => ['electro', 'dance', 'hip-hop', 'trap', 'techno', 'dubstep', 'house', 'edm', 'drum and bass'].includes(g))) {
    return 'bass_realm';
  }

  // 3. BPM fallback (non-overlapping ranges)
  if (bpm > 145) return 'corrupted_signal';
  if (bpm >= 120) return 'bass_realm';
  if (song.mood === 'light' || bpm <= 100) return 'vocal_isolation';

  return 'none';
}
