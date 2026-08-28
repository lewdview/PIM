import type { Note } from './types';
import { supabase } from '../lib/supabase';
import { STORAGE_BASE } from '../services/supabaseClient';
import { getCurrentDay } from '../utils/dayCalc';
import dayFileMap from './day_file_map.json';
import staticSongCatalog from '../data/song_catalog.json';
import { getHighScore as progGetHighScore, saveHighScore as progSaveHighScore } from './progress';

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
}

/** True if the song's release date is still in the future (not yet playable). */
export function isSongTimeLocked(song: GameSong): boolean {
  try {
    const currentDay = getCurrentDay();
    if (song.day <= currentDay) {
      return false;
    }
  } catch (e) {
    console.error("Error evaluating dayCalc in isSongTimeLocked:", e);
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
    const decoded = decodeURIComponent(url);
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

// Helper to resolve URLs dynamically
function resolveSongUrls(song: any, useLocal = false): GameSong {
  const dayStr = String(song.day);
  const mapped = (dayFileMap as any)[dayStr];

  let audioUrl = song.audioUrl;
  let coverArt = song.coverArt;

  const SUPABASE_BASE = STORAGE_BASE;
  const LOCAL_BASE = '/@fs/Volumes/extremeUno/th3scr1b3-365-warp/365-releases/';

  if (useLocal) {
    if (mapped && mapped.audio) {
      audioUrl = LOCAL_BASE + mapped.audio;
    } else if (song.manifestAudioPath) {
      audioUrl = LOCAL_BASE + decodeURIComponent(song.manifestAudioPath);
    }
    if (mapped && mapped.cover) {
      coverArt = LOCAL_BASE + mapped.cover;
    }
  } else {
    if (mapped) {
      if (mapped.audio) {
        const audioPath = mapped.audio.replace(/\.wav$/i, '.mp3');
        audioUrl = SUPABASE_BASE + encodeURIComponent(audioPath).replace(/%2F/g, '/');
      } else {
        audioUrl = FALLBACK_SYNTH_AUDIO;
      }
      if (mapped.cover) {
        coverArt = SUPABASE_BASE + encodeURIComponent(mapped.cover).replace(/%2F/g, '/');
      }
    } else {
      audioUrl = audioUrl || FALLBACK_SYNTH_AUDIO;
    }
  }

  return {
    ...song,
    audioUrl: sanitizeMediaUrl(audioUrl),
    coverArt: sanitizeMediaUrl(coverArt)
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

    const res = await fetch(`/data/songs/${fetchId}.json`);
    if (!res.ok) throw new Error(`Failed to fetch song detail for ${fetchId}`);
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
  const isCorrupted = 
    titleLower.includes('crash') || 
    titleLower.includes('overflow') || 
    titleLower.includes('fault') || 
    titleLower.includes('lock') || 
    titleLower.includes('decay') ||
    song.moodTags?.some(t => ['glitch', 'noise', 'corrupted', 'industrial'].includes(t.toLowerCase())) ||
    song.bpm > 138;
  if (isCorrupted) return 'corrupted_signal';

  const isBass = 
    song.genre?.some(g => ['electro', 'dance', 'hip-hop', 'trap', 'techno', 'dubstep', 'house'].includes(g.toLowerCase())) ||
    song.moodTags?.some(t => ['intense', 'heavy', 'bass', 'hardcore', 'dark', 'synthwave'].includes(t.toLowerCase())) ||
    song.bpm > 120;
  if (isBass) return 'bass_realm';

  const isVocal = 
    song.genre?.some(g => ['pop', 'indie', 'acoustic', 'ambient', 'r&b', 'soul'].includes(g.toLowerCase())) ||
    song.moodTags?.some(t => ['vocal', 'chill', 'ambient', 'melodic', 'emotional'].includes(t.toLowerCase())) ||
    song.mood === 'light' ||
    song.bpm <= 100;
  if (isVocal) return 'vocal_isolation';

  return 'none';
}
