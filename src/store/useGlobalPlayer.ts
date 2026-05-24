import { create } from 'zustand';
import { useLoadingToast } from './useLoadingToast';

// ═══════════════════════════════════════════════════════════════
// Global Audio Player — Singleton store for persistent playback
// Survives route navigation via a shared HTMLAudioElement instance
// ═══════════════════════════════════════════════════════════════

export interface GlobalTrack {
  title: string;
  artist?: string;
  audioUrl: string;
  coverUrl: string;
  day: number;
  rarity: string;
  isDailyClaim?: boolean;
  /** Duration limit in seconds (0 = full song) */
  maxDuration?: number;
}

interface GlobalPlayerState {
  currentTrack: GlobalTrack | null;
  isPlaying: boolean;
  progress: number;     // 0–1
  currentTime: number;  // seconds
  duration: number;     // seconds
  // Actions
  play: (track: GlobalTrack) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (pct: number) => void;
  toggle: () => void;
}

// Singleton Audio element — lives outside React lifecycle
let _audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = 'metadata';
  }
  return _audio;
}

export const useGlobalPlayer = create<GlobalPlayerState>((set, get) => {
  // Wire up event listeners once
  const audio = getAudio();

  audio.addEventListener('timeupdate', () => {
    const state = get();
    const track = state.currentTrack;
    if (!track) return;

    const limit = track.maxDuration || 0;
    const effectiveMax = limit > 0 ? limit : (audio.duration || 0);
    const progress = effectiveMax > 0 ? audio.currentTime / effectiveMax : 0;

    // Auto-stop at limit for preview tracks
    if (limit > 0 && audio.currentTime >= limit) {
      audio.pause();
      audio.currentTime = 0;
      set({ isPlaying: false, progress: 0, currentTime: 0 });
      return;
    }

    set({
      currentTime: audio.currentTime,
      progress: Math.min(progress, 1),
      duration: audio.duration || 0,
    });
  });

  audio.addEventListener('ended', () => {
    set({ isPlaying: false, progress: 0, currentTime: 0 });
  });

  audio.addEventListener('loadedmetadata', () => {
    set({ duration: audio.duration || 0 });
  });

  audio.addEventListener('error', () => {
    console.error('Global player error');
    set({ isPlaying: false });
    useLoadingToast.getState().hide();
  });

  audio.addEventListener('playing', () => {
    useLoadingToast.getState().hide();
  });

  audio.addEventListener('waiting', () => {
    if (get().currentTrack) {
      useLoadingToast.getState().show('Buffering audio…');
    }
  });

  return {
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: 0,

    play: (track: GlobalTrack) => {
      const audio = getAudio();
      // If same track, just resume
      const current = get().currentTrack;
      if (current && current.audioUrl === track.audioUrl && current.day === track.day) {
        audio.play().catch(console.error);
        set({ isPlaying: true, currentTrack: track });
        return;
      }
      // New track
      audio.pause();
      audio.src = track.audioUrl;
      audio.currentTime = 0;
      useLoadingToast.getState().show('Loading track…');
      audio.play().catch(console.error);
      set({
        currentTrack: track,
        isPlaying: true,
        progress: 0,
        currentTime: 0,
        duration: 0,
      });
    },

    pause: () => {
      getAudio().pause();
      set({ isPlaying: false });
    },

    resume: () => {
      getAudio().play().catch(console.error);
      set({ isPlaying: true });
    },

    stop: () => {
      const audio = getAudio();
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      set({
        currentTrack: null,
        isPlaying: false,
        progress: 0,
        currentTime: 0,
        duration: 0,
      });
    },

    seek: (pct: number) => {
      const audio = getAudio();
      const track = get().currentTrack;
      if (!track) return;
      const limit = track.maxDuration || 0;
      const effectiveMax = limit > 0 ? limit : (audio.duration || 0);
      if (effectiveMax > 0) {
        audio.currentTime = pct * effectiveMax;
        set({
          currentTime: audio.currentTime,
          progress: pct,
        });
      }
    },

    toggle: () => {
      const state = get();
      if (state.isPlaying) {
        state.pause();
      } else if (state.currentTrack) {
        state.resume();
      }
    },
  };
});
