import type { Note } from './types';
import { supabase } from '../lib/supabase';
import { getCurrentDay } from '../utils/dayCalc';
import dayFileMap from './day_file_map.json';
import { getHighScore as progGetHighScore, saveHighScore as progSaveHighScore } from './progress';

export interface LyricsWord {
  word: string;
  start: number;
  end: number;
}

export interface GameSong {
  id: string;
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

// Helper to resolve URLs dynamically
function resolveSongUrls(song: any, useLocal = false): GameSong {
  const dayStr = String(song.day);
  const mapped = (dayFileMap as any)[dayStr];

  let audioUrl = song.audioUrl;
  let coverArt = song.coverArt;

  const SUPABASE_BASE = 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/';
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
        audioUrl = SUPABASE_BASE + encodeURIComponent(mapped.audio).replace(/%2F/g, '/');
      }
      if (mapped.cover) {
        coverArt = SUPABASE_BASE + encodeURIComponent(mapped.cover).replace(/%2F/g, '/');
      }
    }
  }

  return {
    ...song,
    audioUrl,
    coverArt
  };
}

export async function loadCatalog(): Promise<GameSong[]> {
  if (catalogCache) return catalogCache;
  if (loadingPromise) return loadingPromise;

  const promise = (async (): Promise<GameSong[]> => {
    try {
      const useLocal = (typeof localStorage !== 'undefined' && (localStorage.getItem('opt_useLocalFiles') === 'true' || localStorage.getItem('useLocalFiles') === 'true')) || 
                       (import.meta.env && import.meta.env.VITE_USE_LOCAL_FILES === 'true');

      // 1. Try Supabase first if configured and not forcing local
      if (supabase && !useLocal) {
        const { data, error } = await supabase
          .from('releases')
          .select('*')
          .eq('status', 'released')
          .order('day', { ascending: true });

        if (!error && data && data.length > 0) {
          console.log('Fetched catalog from Supabase');
          catalogCache = data.map((r) => resolveSongUrls({
            id: r.id,
            day: r.day,
            date: r.date,
            title: r.title || r.canonicalTitle || `Day ${r.day}`,
            artist: 'TH3SCR1B3',
            bpm: r.tempo || 100,
            duration: Math.ceil(r.duration || 180),
            mood: r.mood === 'light' ? 'light' : 'dark',
            valence: r.valence ?? 0.5,
            moodTags: Array.isArray(r.tags) ? r.tags.slice(0, 3) : [],
            description: r.description || '',
            audioUrl: r.storedAudioUrl,
            coverArt: r.coverArt || null,
            notes: [],
            key: r.key || '',
            genre: Array.isArray(r.genre) ? r.genre : [],
            difficultyLevel: 5, // default catalog difficulty
            unlock: {
              card: `card-${r.day}`,
              fragments: 10
            }
          }, false));
          return catalogCache;
        }
        if (error) console.error('Supabase fetch error:', error);
      }

      // 2. Load from local static catalog file
      const r = await fetch('/data/song_catalog.json');
      const catalog = await r.json();
      console.log(`Fetched catalog from song_catalog.json fallback (useLocal: ${useLocal})`);
      catalogCache = catalog.map((s: any) => resolveSongUrls(s, useLocal));
      return catalogCache;
    } catch (err) {
      console.error('Failed to load catalog:', err);
      return [];
    }
  })();

  loadingPromise = promise;
  return promise;
}

export async function getSongById(id: string): Promise<GameSong | null> {
  const catalog = await loadCatalog();
  let basicSong = catalog.find((s) => s.id === id);

  if (!basicSong) {
    const match = id.match(/\d+/);
    if (match) {
      const dayNum = parseInt(match[0], 10);
      basicSong = catalog.find((s) => s.day === dayNum);
    }
  }

  if (!basicSong) return null;

  try {
    const useLocal = (typeof localStorage !== 'undefined' && (localStorage.getItem('opt_useLocalFiles') === 'true' || localStorage.getItem('useLocalFiles') === 'true')) || 
                     (import.meta.env && import.meta.env.VITE_USE_LOCAL_FILES === 'true');

    const fileId = basicSong.id.startsWith('day-') ? basicSong.id : `day-${String(basicSong.day).padStart(3, '0')}`;
    const fetchId = basicSong.id.includes('-') && !basicSong.id.startsWith('day-') ? basicSong.id : fileId;

    const res = await fetch(`/data/songs/${fetchId}.json`);
    if (!res.ok) throw new Error(`Failed to fetch song detail for ${fetchId}`);
    const fullDetail = await res.json();

    return resolveSongUrls(fullDetail, useLocal);
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
