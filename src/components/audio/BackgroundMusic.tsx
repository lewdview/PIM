import { useEffect, useRef, useCallback, useState } from "react";
import { useLocation } from "wouter";
import { audioManager } from "../../game/audio";
import { loadOpts } from "../../lib/options";

/**
 * BackgroundMusic — persistent ambient music for menu screens.
 *
 * Design decisions:
 *  - Uses a regular HTMLAudioElement (not AudioContext) for long bg loops
 *    to avoid decoding 30MB+ WAVs entirely into memory.
 *  - Audio is NOT auto-played on mount — browsers block it. Instead we
 *    listen for the first user click/tap anywhere on the page and start
 *    playback then. This also triggers SFX preloading.
 *  - Fades out smoothly when entering /play/* routes; fades back in on exit.
 *  - Also pauses on /results/* to let the results ambient play unobstructed.
 *  - Volume fading uses requestAnimationFrame (not setInterval) to avoid
 *    competing with the game's rAF loop and causing main thread thrashing.
 */
export default function BackgroundMusic() {
  const [location] = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [started, setStarted] = useState(false);
  const fadeRafRef = useRef<number | undefined>(undefined);

  const [introDone, setIntroDone] = useState(() => !!sessionStorage.getItem("intro_seen"));
  const [bgMusicEnabled, setBgMusicEnabled] = useState(() => loadOpts().bgMusic);
  
  useEffect(() => {
    const onToggle = () => setBgMusicEnabled(loadOpts().bgMusic);
    const onVolChange = () => {
      const opts = loadOpts();
      if (audioRef.current && opts.bgMusic) {
        audioRef.current.volume = (opts.musicVolume ?? 0.5) * 0.4;
      }
    };
    window.addEventListener("bgmusic_toggle", onToggle);
    window.addEventListener("bgmusic_volume_change", onVolChange);
    return () => {
      window.removeEventListener("bgmusic_toggle", onToggle);
      window.removeEventListener("bgmusic_volume_change", onVolChange);
    };
  }, []);
  
  useEffect(() => {
    const onIntroDone = () => setIntroDone(true);
    window.addEventListener("intro_finished", onIntroDone);
    return () => window.removeEventListener("intro_finished", onIntroDone);
  }, []);

  const isSilentRoute = location.startsWith("/play/") || location.startsWith("/results/") || location.startsWith("/tutorial") || (location === "/" && !introDone);

  // Create (but don't play) the bg audio element once
  useEffect(() => {
    const BG_TRACKS = ['bg1', 'bg2', 'bg3', 'bg5', 'bg8', 'bg9', 'bg_4'];
    let nextBgIdx = Math.floor(Math.random() * BG_TRACKS.length);
    
    const audio = new Audio(`/audio/sfx/${BG_TRACKS[nextBgIdx]}.wav`);
    audio.loop = false;
    audio.volume = 0;
    audio.preload = "none"; // don't download until user clicks
    audioRef.current = audio;
    
    const onEnded = () => {
      nextBgIdx = (nextBgIdx + 1) % BG_TRACKS.length;
      audio.src = `/audio/sfx/${BG_TRACKS[nextBgIdx]}.wav`;
      audio.load();
      audio.play().catch(() => {});
    };
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  // Start bg music on first user interaction
  const startOnInteraction = useCallback(() => {
    setStarted((prev) => {
      if (prev) return prev;
      
      const { bgMusic, musicVolume } = loadOpts();
      const audio = audioRef.current;
      if (audio && bgMusic) {
        audio.preload = "auto";
        audio.load();
        audio.volume = 0;
        audio.play().catch(() => {});
      }

      // Preload all SFX on first interaction
      audioManager.preloadAll();
      return true;
    });
  }, []);

  useEffect(() => {
    document.addEventListener("click", startOnInteraction, { once: true });
    document.addEventListener("touchstart", startOnInteraction, { once: true });
    return () => {
      document.removeEventListener("click", startOnInteraction);
      document.removeEventListener("touchstart", startOnInteraction);
    };
  }, [startOnInteraction]);

  // Fade in/out based on route — uses rAF instead of setInterval to avoid
  // competing with the game's requestAnimationFrame loop
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !started) return;

    if (fadeRafRef.current !== undefined) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = undefined;
    }

    if (isSilentRoute || !bgMusicEnabled) {
      // Immediate stop on silent routes or when bgMusic is disabled
      audio.pause();
      audio.volume = 0;
    } else {
      const targetVol = (loadOpts().musicVolume ?? 0.5) * 0.4;
      // Resume → fade in
      if (audio.paused) {
        audio.volume = 0;
        const p = audio.play();
        if (p !== undefined) {
          p.catch(() => {});
        }
      }
      // rAF-based fade: ~0.75 volume/sec at 60fps (0.03 per 40ms ≈ 0.0125 per 16.67ms)
      let lastTime = 0;
      const fadeStep = (timestamp: number) => {
        if (!lastTime) lastTime = timestamp;
        const dt = (timestamp - lastTime) / 1000; // seconds elapsed
        lastTime = timestamp;
        const step = dt * 0.75; // 0.75 volume units per second
        if (audio.volume < targetVol) {
          audio.volume = Math.min(targetVol, audio.volume + step);
          fadeRafRef.current = requestAnimationFrame(fadeStep);
        } else {
          audio.volume = targetVol;
          fadeRafRef.current = undefined;
        }
      };
      fadeRafRef.current = requestAnimationFrame(fadeStep);
    }

    return () => {
      if (fadeRafRef.current !== undefined) {
        cancelAnimationFrame(fadeRafRef.current);
        fadeRafRef.current = undefined;
      }
    };
  }, [isSilentRoute, started, bgMusicEnabled]);

  return null;
}
