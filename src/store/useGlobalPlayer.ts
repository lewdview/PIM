import { create } from 'zustand';
import { useLoadingToast } from './useLoadingToast';
import { getCandidateAudioUrls, sanitizeMediaUrl } from '../game/api';

// ═══════════════════════════════════════════════════════════════
// Global Audio Player — Singleton store for persistent playback
// Survives route navigation via a shared HTMLAudioElement instance
// ═══════════════════════════════════════════════════════════════

export interface GlobalTrack {
  id?: string;
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

export type PlayerLoopMode = 'all' | 'one' | 'off';

interface GlobalPlayerState {
  currentTrack: GlobalTrack | null;
  playlist: GlobalTrack[];
  playlistIndex: number;
  isPlaying: boolean;
  progress: number;     // 0–1
  currentTime: number;  // seconds
  duration: number;     // seconds
  loopMode: PlayerLoopMode;
  shuffle: boolean;
  volume: number;

  // Actions
  play: (track: GlobalTrack, newPlaylist?: GlobalTrack[]) => void;
  setPlaylist: (tracks: GlobalTrack[], startIndex?: number, autoPlay?: boolean) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seek: (pct: number) => void;
  toggle: () => void;
  setLoopMode: (mode: PlayerLoopMode) => void;
  toggleShuffle: () => void;
  setVolume: (vol: number) => void;
}

// Singleton Audio element — lives outside React lifecycle
let _audio: HTMLAudioElement | null = null;
let _candidateUrls: string[] = [];
let _candidateIdx = 0;

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = 'metadata';
    _audio.volume = 0.8;
  }
  return _audio;
}

export const useGlobalPlayer = create<GlobalPlayerState>((set, get) => {
  const audio = getAudio();

  // PERF: Throttle timeupdate store writes to ~2Hz to avoid forcing React
  // re-renders on subscribed components during active gameplay.
  // The raw audio.currentTime can still be read directly for precision needs.
  let _lastTimeUpdate = 0;
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
      // If playlist has items, advance to next
      if (state.playlist.length > 1) {
        state.nextTrack();
      }
      return;
    }

    // Throttle routine progress updates to max 2Hz
    const now = performance.now();
    if (now - _lastTimeUpdate < 500) return;
    _lastTimeUpdate = now;

    set({
      currentTime: audio.currentTime,
      progress: Math.min(progress, 1),
      duration: audio.duration || 0,
    });
  });

  // Track completion -> automatic seamless playlist advancement
  audio.addEventListener('ended', () => {
    const state = get();
    if (state.loopMode === 'one') {
      audio.currentTime = 0;
      audio.play().catch(console.error);
      set({ isPlaying: true, progress: 0, currentTime: 0 });
      return;
    }

    if (state.playlist.length > 0) {
      state.nextTrack();
    } else {
      set({ isPlaying: false, progress: 0, currentTime: 0 });
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    set({ duration: audio.duration || 0 });
  });

  audio.addEventListener('error', () => {
    console.warn('Global player error:', audio.src, audio.error);
    _candidateIdx++;
    if (_candidateIdx < _candidateUrls.length) {
      const nextCandidate = _candidateUrls[_candidateIdx];
      console.log('[GlobalPlayer] Retrying next candidate audio URL:', nextCandidate);
      audio.src = nextCandidate;
      audio.load();
      audio.play().catch(console.warn);
      return;
    }
    
    // If current track failed completely, try advancing to next track if available
    const state = get();
    if (state.playlist.length > 1) {
      console.log('[GlobalPlayer] Skipping failed track to next in playlist');
      state.nextTrack();
      return;
    }

    set({ isPlaying: false });
    useLoadingToast.getState().show('Failed to stream audio file from Supabase.');
    setTimeout(() => {
      useLoadingToast.getState().hide();
    }, 4000);
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
    playlist: [],
    playlistIndex: -1,
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    loopMode: 'all',
    shuffle: false,
    volume: 0.8,

    play: (track: GlobalTrack, newPlaylist?: GlobalTrack[]) => {
      const audio = getAudio();
      const sanitizedAudioUrl = sanitizeMediaUrl(track.audioUrl);
      const sanitizedTrack: GlobalTrack = {
        ...track,
        audioUrl: sanitizedAudioUrl,
        coverUrl: sanitizeMediaUrl(track.coverUrl),
      };

      const playlistToUse = newPlaylist || get().playlist;
      let targetIndex = playlistToUse.findIndex(
        (t) => t.day === sanitizedTrack.day || t.audioUrl === sanitizedTrack.audioUrl
      );

      if (targetIndex === -1 && playlistToUse.length === 0) {
        playlistToUse.push(sanitizedTrack);
        targetIndex = 0;
      }

      // If same track, just resume
      const current = get().currentTrack;
      if (current && current.audioUrl === sanitizedTrack.audioUrl && current.day === sanitizedTrack.day) {
        audio.play().catch(console.error);
        set({
          isPlaying: true,
          currentTrack: sanitizedTrack,
          playlist: playlistToUse,
          playlistIndex: targetIndex !== -1 ? targetIndex : 0,
        });
        return;
      }

      // Setup candidates for resilient playback
      _candidateUrls = getCandidateAudioUrls(sanitizedTrack.audioUrl, sanitizedTrack.day);
      _candidateIdx = 0;
      const initialSrc = _candidateUrls[0] || sanitizedTrack.audioUrl;

      // New track
      audio.pause();
      audio.src = initialSrc;
      audio.currentTime = 0;
      useLoadingToast.getState().show('Loading track…');
      audio.play().catch(console.error);

      set({
        currentTrack: sanitizedTrack,
        playlist: playlistToUse,
        playlistIndex: targetIndex !== -1 ? targetIndex : 0,
        isPlaying: true,
        progress: 0,
        currentTime: 0,
        duration: 0,
      });
    },

    setPlaylist: (tracks: GlobalTrack[], startIndex = 0, autoPlay = true) => {
      if (!tracks || tracks.length === 0) return;
      const validIndex = Math.max(0, Math.min(tracks.length - 1, startIndex));
      set({ playlist: tracks, playlistIndex: validIndex });
      if (autoPlay) {
        get().play(tracks[validIndex], tracks);
      }
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
      audio.removeAttribute('src');
      try {
        audio.load();
      } catch {}
      set({
        currentTrack: null,
        isPlaying: false,
        progress: 0,
        currentTime: 0,
        duration: 0,
      });
    },

    nextTrack: () => {
      const { playlist, playlistIndex, shuffle, loopMode } = get();
      if (playlist.length === 0) return;

      if (playlist.length === 1) {
        if (loopMode !== 'off') {
          get().play(playlist[0]);
        }
        return;
      }

      let nextIndex = playlistIndex + 1;
      if (shuffle) {
        let randIdx = Math.floor(Math.random() * playlist.length);
        if (randIdx === playlistIndex && playlist.length > 1) {
          randIdx = (randIdx + 1) % playlist.length;
        }
        nextIndex = randIdx;
      } else if (nextIndex >= playlist.length) {
        if (loopMode === 'off') {
          get().stop();
          return;
        }
        nextIndex = 0;
      }

      const nextTrack = playlist[nextIndex];
      if (nextTrack) {
        get().play(nextTrack, playlist);
      }
    },

    previousTrack: () => {
      const { playlist, playlistIndex, shuffle } = get();
      const audio = getAudio();
      
      // If played more than 3 seconds, replay current song first
      if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
      }

      if (playlist.length === 0) return;

      let prevIndex = playlistIndex - 1;
      if (shuffle) {
        prevIndex = Math.floor(Math.random() * playlist.length);
      } else if (prevIndex < 0) {
        prevIndex = playlist.length - 1;
      }

      const prevTrack = playlist[prevIndex];
      if (prevTrack) {
        get().play(prevTrack, playlist);
      }
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

    setLoopMode: (mode: PlayerLoopMode) => {
      set({ loopMode: mode });
    },

    toggleShuffle: () => {
      set((s) => ({ shuffle: !s.shuffle }));
    },

    setVolume: (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      getAudio().volume = clamped;
      set({ volume: clamped });
    },
  };
});
