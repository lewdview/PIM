import React, { useEffect, useRef, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { getSongById, loadCatalog, type GameSong } from '../game/api';
import { audioManager } from '../game/audio';
import { useVaultStore } from '../store/useVaultStore';
import { Play, Pause, SkipForward, SkipBack, X, Music } from 'lucide-react';

// Types for particles in the visualizer
interface VisualizerParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

type GeometryType = 'flower_of_life' | 'sri_yantra' | 'metatrons_cube' | 'bipolar_torus' | 'lakshmi_star';

export default function ListenPage() {
  const [, params] = useRoute('/listen/:songId');
  const songId = params?.songId || '';
  const [location, setLocation] = useLocation();

  const [playlist, setPlaylist] = useState<GameSong[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [song, setSong] = useState<GameSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [geometryType, setGeometryType] = useState<GeometryType>('flower_of_life');
  const [neonTheme, setNeonTheme] = useState<'cyan_pink' | 'emerald_orange' | 'gold_purple' | 'rainbow'>('cyan_pink');
  const [playlistOpen, setPlaylistOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<VisualizerParticle[]>([]);

  // Track page history to go back to the correct origin page
  const [backRoute, setBackRoute] = useState('/songs');

  // Load store values
  const collection = useVaultStore((s) => s.collection);
  const fragments = useVaultStore((s) => s.fragments);

  const getFragmentsForDay = (day: number) => {
    const cardKey = `card-${day}`;
    const dayKey = `day-${String(day).padStart(3, '0')}`;
    const dayKeyRaw = `day-${day}`;
    return (
      fragments[cardKey] ??
      fragments[dayKey] ??
      fragments[dayKeyRaw] ??
      0
    );
  };

  const isSongUnlocked = (s: GameSong) => {
    const isOwned = Array.isArray(collection) 
      ? collection.some(c => c && (c.cardId === s.id || `card-${c.card?.day}` === s.id || c.cardId === `card-${s.day}`)) 
      : false;
    return isOwned || getFragmentsForDay(s.day) >= 10;
  };

  // 1. Initial playlist setup
  useEffect(() => {
    const origin = sessionStorage.getItem(`game_origin_${songId}`) || 'songs';
    setBackRoute(origin === 'songs' ? '/songs' : origin ? `/${origin}` : '/campaign');

    const setupPlaylist = async () => {
      const allSongs = await loadCatalog();
      // Filter only unlocked/owned songs
      const unlockedSongs = allSongs.filter(isSongUnlocked);
      setPlaylist(unlockedSongs);

      // Find initial song index
      const initialIndex = unlockedSongs.findIndex(s => s.id === songId || `card-${s.day}` === songId);
      if (initialIndex !== -1) {
        setCurrentTrackIndex(initialIndex);
        const targetSong = unlockedSongs[initialIndex];
        setSong(targetSong);
        setDuration(targetSong.duration || 180);
      } else if (unlockedSongs.length > 0) {
        setCurrentTrackIndex(0);
        const targetSong = unlockedSongs[0];
        setSong(targetSong);
        setDuration(targetSong.duration || 180);
      }
      setLoading(false);
    };

    setupPlaylist();

    return () => {
      cleanupAudio();
    };
  }, [songId, collection, fragments]);

  const cleanupAudio = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
  };

  const loadTrack = (track: GameSong) => {
    cleanupAudio();
    setSong(track);
    setDuration(track.duration || 180);
    setCurrentTime(0);

    const audio = new Audio(track.audioUrl);
    audio.crossOrigin = 'anonymous';
    audio.volume = 0.6;
    audioRef.current = audio;

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('durationchange', () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    });

    audio.addEventListener('ended', () => {
      handleNextTrack();
    });

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      
      if (playing) {
        audio.play().catch(err => console.error('[ListenPage] Autoplay failed:', err));
      }
    } catch (e) {
      console.warn('[ListenPage] Web Audio Context failed, running in sandbox simulated mode:', e);
      if (playing) {
        audio.play().catch(err => console.error('[ListenPage] Autoplay failed:', err));
      }
    }
  };

  const handleTogglePlay = () => {
    audioManager.playSfx('tap_nav', 0.2);

    if (!audioRef.current && song) {
      loadTrack(song);
    }

    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        audioRef.current.play().catch((err) => {
          console.error('[ListenPage] Failed to play audio:', err);
        });
        setPlaying(true);
      }
    } else {
      setPlaying(true);
    }
  };

  const handleNextTrack = () => {
    if (playlist.length <= 1) return;
    audioManager.playSfx('tap_nav', 0.15);
    const nextIdx = (currentTrackIndex + 1) % playlist.length;
    setCurrentTrackIndex(nextIdx);
    loadTrack(playlist[nextIdx]);
  };

  const handlePrevTrack = () => {
    if (playlist.length <= 1) return;
    audioManager.playSfx('tap_nav', 0.15);
    const prevIdx = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    setCurrentTrackIndex(prevIdx);
    loadTrack(playlist[prevIdx]);
  };

  const handleSelectPlaylistTrack = (idx: number) => {
    audioManager.playSfx('tap_nav', 0.15);
    setCurrentTrackIndex(idx);
    loadTrack(playlist[idx]);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleBack = () => {
    cleanupAudio();
    audioManager.playSfx('back', 0.4);
    setLocation(backRoute);
  };

  // --- Visualizer Drawing Loop ---
  useEffect(() => {
    if (loading || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let rotationAngle = 0;
    let colorShift = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const size = Math.min(w, h) * 0.35;
      const cx = w / 2;
      const cy = h / 2;

      ctx.fillStyle = 'rgba(5, 4, 3, 0.12)';
      ctx.fillRect(0, 0, w, h);

      let frequencies = new Uint8Array(128);
      let volume = 0;
      let bass = 0;
      let mid = 0;
      let high = 0;

      if (playing && analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        frequencies = dataArrayRef.current;
        
        for (let i = 0; i < frequencies.length; i++) {
          volume += frequencies[i];
          if (i < 10) bass += frequencies[i];
          else if (i < 50) mid += frequencies[i];
          else high += frequencies[i];
        }
        volume /= frequencies.length;
        bass /= 10;
        mid /= 40;
        high /= (frequencies.length - 50);
      } else if (playing) {
        const t = Date.now() / 1000;
        bass = 50 + Math.sin(t * 8) * 30 + (Math.floor(t * 2) % 2 === 0 ? 40 : 0);
        mid = 40 + Math.cos(t * 5) * 20;
        high = 30 + Math.sin(t * 12) * 15;
        volume = (bass + mid + high) / 3;
      }

      const bassN = Math.min(1, bass / 255);
      const midN = Math.min(1, mid / 255);
      const highN = Math.min(1, high / 255);

      const getColor = (offset: number) => {
        const t = (colorShift + offset) % 360;
        if (neonTheme === 'cyan_pink') {
          return `hsla(${180 + Math.sin(t * Math.PI / 180) * 80}, 100%, 60%, 0.85)`;
        } else if (neonTheme === 'emerald_orange') {
          return `hsla(${120 + Math.sin(t * Math.PI / 180) * 90}, 100%, 55%, 0.85)`;
        } else if (neonTheme === 'gold_purple') {
          return `hsla(${45 + Math.sin(t * Math.PI / 180) * 110}, 100%, 58%, 0.85)`;
        } else {
          return `hsla(${t}, 100%, 65%, 0.85)`;
        }
      };

      const bassScale = 1.0 + bassN * 0.15;
      rotationAngle += 0.003 + midN * 0.008;
      colorShift = (colorShift + 0.4 + highN * 1.2) % 360;

      const glowGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 2);
      glowGrad.addColorStop(0, `${getColor(0).replace('0.85', '0.04')}`);
      glowGrad.addColorStop(0.5, `${getColor(120).replace('0.85', '0.015')}`);
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      if (playing && Math.random() < 0.1 + bassN * 0.4) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + midN * 4;
        particlesRef.current.push({
          x: cx + Math.cos(angle) * (size * 0.2),
          y: cy + Math.sin(angle) * (size * 0.2),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1 + Math.random() * 4 + highN * 3,
          color: getColor(Math.random() * 100),
          alpha: 1.0,
          life: 0,
          maxLife: 60 + Math.random() * 60
        });
      }

      particlesRef.current = particlesRef.current.filter(p => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha = 1 - (p.life / p.maxLife);
        
        ctx.save();
        ctx.shadowBlur = p.size * 2;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color.replace('0.85', String(p.alpha * 0.8));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return p.life < p.maxLife;
      });

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(bassScale, bassScale);
      ctx.rotate(rotationAngle);
      ctx.shadowBlur = 15 + midN * 25;

      if (geometryType === 'flower_of_life') {
        const radius = size * 0.24;
        ctx.lineWidth = 1.2 + midN * 1.5;
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const ox = Math.cos(angle) * radius;
          const oy = Math.sin(angle) * radius;
          ctx.strokeStyle = getColor(i * 30);
          ctx.shadowColor = getColor(i * 30);
          
          ctx.beginPath();
          ctx.arc(ox, oy, radius, 0, Math.PI * 2);
          ctx.stroke();

          const outerAngle = angle + Math.PI / 6;
          const oox = Math.cos(outerAngle) * radius * Math.sqrt(3);
          const ooy = Math.sin(outerAngle) * radius * Math.sqrt(3);
          ctx.strokeStyle = getColor(i * 30 + 60);
          ctx.shadowColor = getColor(i * 30 + 60);
          ctx.beginPath();
          ctx.arc(oox, ooy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.strokeStyle = getColor(0);
        ctx.shadowColor = getColor(0);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

      } else if (geometryType === 'sri_yantra') {
        const scaleFact = size * 0.9;
        ctx.lineWidth = 1.0 + midN * 2.0;

        const drawYantraTriangle = (yCenter: number, r: number, pointingUp: boolean, hueOffset: number) => {
          ctx.strokeStyle = getColor(hueOffset);
          ctx.shadowColor = getColor(hueOffset);
          ctx.beginPath();
          const yTip = pointingUp ? yCenter - r : yCenter + r;
          const yBase = pointingUp ? yCenter + r * 0.5 : yCenter - r * 0.5;
          const xOffset = r * Math.sqrt(3) * 0.5;
          ctx.moveTo(0, yTip);
          ctx.lineTo(xOffset, yBase);
          ctx.lineTo(-xOffset, yBase);
          ctx.closePath();
          ctx.stroke();
        };

        drawYantraTriangle(0, scaleFact * 0.5, true, 0);
        drawYantraTriangle(0, scaleFact * 0.5, false, 40);
        drawYantraTriangle(-scaleFact * 0.05, scaleFact * 0.4, true, 80);
        drawYantraTriangle(scaleFact * 0.05, scaleFact * 0.4, false, 120);
        drawYantraTriangle(scaleFact * 0.03, scaleFact * 0.3, true, 160);
        drawYantraTriangle(-scaleFact * 0.03, scaleFact * 0.3, false, 200);
        drawYantraTriangle(0, scaleFact * 0.2, true, 240);
        drawYantraTriangle(0, scaleFact * 0.2, false, 280);

        ctx.strokeStyle = getColor(180);
        ctx.shadowColor = getColor(180);
        ctx.beginPath();
        ctx.arc(0, 0, scaleFact * 0.58, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, scaleFact * 0.65, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const px = Math.cos(angle) * (scaleFact * 0.7);
          const py = Math.sin(angle) * (scaleFact * 0.7);
          ctx.strokeStyle = getColor(i * 45);
          ctx.shadowColor = getColor(i * 45);
          ctx.beginPath();
          ctx.arc(px, py, scaleFact * 0.08, 0, Math.PI * 2);
          ctx.stroke();
        }

      } else if (geometryType === 'metatrons_cube') {
        const rad = size * 0.25;
        const nodes: {x: number, y: number, color: string}[] = [];
        ctx.lineWidth = 0.8 + midN * 1.5;

        nodes.push({ x: 0, y: 0, color: getColor(0) });
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          nodes.push({
            x: Math.cos(angle) * rad,
            y: Math.sin(angle) * rad,
            color: getColor(i * 30)
          });
          nodes.push({
            x: Math.cos(angle) * rad * 2,
            y: Math.sin(angle) * rad * 2,
            color: getColor(i * 30 + 60)
          });
        }

        for (let a = 0; a < nodes.length; a++) {
          for (let b = a + 1; b < nodes.length; b++) {
            ctx.strokeStyle = nodes[a].color.replace('0.85', '0.22');
            ctx.shadowColor = 'transparent';
            ctx.beginPath();
            ctx.moveTo(nodes[a].x, nodes[a].y);
            ctx.lineTo(nodes[b].x, nodes[b].y);
            ctx.stroke();
          }
        }

        nodes.forEach((n) => {
          ctx.strokeStyle = n.color;
          ctx.shadowColor = n.color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, rad * 0.45, 0, Math.PI * 2);
          ctx.stroke();
        });

      } else if (geometryType === 'bipolar_torus') {
        const rad = size * 0.95;
        ctx.lineWidth = 1.0 + highN * 2.0;
        const circlesCount = 12;
        for (let i = 1; i <= circlesCount; i++) {
          const ratio = i / circlesCount;
          const cyOffset = rad * (1 - ratio);
          const currentRad = rad * ratio;

          ctx.strokeStyle = getColor(i * 25);
          ctx.shadowColor = getColor(i * 25);

          ctx.beginPath();
          ctx.arc(0, -cyOffset, currentRad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, cyOffset, currentRad, 0, Math.PI * 2);
          ctx.stroke();
        }

      } else if (geometryType === 'lakshmi_star') {
        const rad = size * 0.72;
        ctx.lineWidth = 1.2 + midN * 2.0;

        const drawSquare = (angle: number, colorIdx: number) => {
          ctx.save();
          ctx.rotate(angle);
          ctx.strokeStyle = getColor(colorIdx);
          ctx.shadowColor = getColor(colorIdx);
          ctx.beginPath();
          ctx.rect(-rad * 0.5, -rad * 0.5, rad, rad);
          ctx.stroke();
          ctx.restore();
        };

        drawSquare(0, 0);
        drawSquare(Math.PI / 4, 80);

        ctx.strokeStyle = getColor(160);
        ctx.shadowColor = getColor(160);
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.35, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = getColor(240);
        ctx.shadowColor = getColor(240);
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.2, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const nx = Math.cos(angle) * rad * 0.7;
          const ny = Math.sin(angle) * rad * 0.7;
          ctx.strokeStyle = getColor(i * 30);
          ctx.shadowColor = getColor(i * 30);
          ctx.beginPath();
          ctx.arc(nx, ny, 10 + bassN * 12, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 1.05, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = getColor(0).replace('0.85', '0.2');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 1.05 + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [loading, geometryType, neonTheme, playing]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#070604] text-white">
        <div className="font-mono text-xs tracking-[0.4em] animate-pulse uppercase text-white/50">
          Syncing visual projection...
        </div>
      </div>
    );
  }

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const coverArtSrc = song?.coverArt || song?.coverUrl || '/data/covers/default.jpg';

  return (
    <div className="relative min-h-screen bg-[#050403] text-white overflow-hidden flex items-center justify-center">
      {/* Fullscreen Canvas Visualizer */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block w-full h-full" />

      {/* Retro glass scanlines filter */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-scanlines opacity-[0.03]" />

      {/* Floating Header back button */}
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors uppercase font-mono text-[9px] tracking-widest text-white/70"
        >
          <span>←</span> EXIT VISUALIZER
        </button>
      </div>

      {/* GLASSMORPHIC PANEL DASHBOARD */}
      <div className="absolute bottom-10 left-6 right-6 md:left-auto md:right-10 md:w-[420px] z-20 backdrop-blur-[24px] bg-[#0c0c0e]/65 border border-white/15 rounded-3xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col gap-5 transition-all duration-300">
        {/* Glowing Accent Indicator */}
        <div className="absolute -top-1 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-[#39FF14] to-transparent opacity-80" />

        {/* Cover Art and Info Header with Close Icon */}
        <div className="flex gap-4 items-center relative">
          <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0">
            <img src={coverArtSrc} alt={song?.title} className="w-full h-full object-cover" />
          </div>
          <div className="overflow-hidden flex-1 pr-6">
            <div className="font-mono text-[9px] tracking-[0.2em] text-[#39FF14] uppercase font-black mb-1">
              JUST LISTEN // PLAYLIST
            </div>
            <h2 className="text-base font-black truncate uppercase tracking-tight text-white mb-0.5">
              {song?.title || 'Unknown Title'}
            </h2>
            <p className="font-mono text-[10px] text-white/50 truncate uppercase">
              {song?.artist || 'Unknown Artist'}
            </p>
          </div>
          {/* Quick Exit Cross button */}
          <button
            onClick={handleBack}
            className="absolute top-0 right-0 w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors opacity-60 hover:opacity-100 active:scale-95 duration-150 cursor-pointer z-50"
            title="Exit Visualizer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Interactive Progress Slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between font-mono text-[9px] text-white/40">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 180}
            value={currentTime}
            onChange={handleSeek}
            disabled={!audioRef.current}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#39FF14] focus:outline-none"
            style={{
              background: `linear-gradient(to right, #39FF14 0%, #39FF14 ${progressPercentage}%, rgba(255,255,255,0.1) ${progressPercentage}%, rgba(255,255,255,0.1) 100%)`
            }}
          />
        </div>

        {/* Playlist Controls (Skip / Play) */}
        <div className="flex justify-between items-center px-4">
          <button
            onClick={handlePrevTrack}
            disabled={playlist.length <= 1}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Previous Track"
          >
            <SkipBack size={18} />
          </button>
          
          <button
            onClick={handleTogglePlay}
            className={`flex items-center justify-center w-14 h-14 rounded-full transition-all shadow-md cursor-pointer ${
              playing
                ? 'bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10'
                : 'bg-[#39FF14] border border-[#39FF14] text-black hover:bg-[#39FF14]/90'
            }`}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
          </button>

          <button
            onClick={handleNextTrack}
            disabled={playlist.length <= 1}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Next Track"
          >
            <SkipForward size={18} />
          </button>
        </div>

        {/* Action Controls & Toggles */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[8px] tracking-wider text-white/40 uppercase">
              Geometry Shape
            </span>
            <select
              value={geometryType}
              onChange={(e) => {
                audioManager.playSfx('tap_nav', 0.1);
                setGeometryType(e.target.value as GeometryType);
              }}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-mono font-bold tracking-wider text-white focus:outline-none focus:border-[#39FF14]/50 cursor-pointer"
            >
              <option value="flower_of_life" className="bg-[#121214]">Flower of Life</option>
              <option value="sri_yantra" className="bg-[#121214]">Sri Yantra</option>
              <option value="metatrons_cube" className="bg-[#121214]">Metatron's Cube</option>
              <option value="bipolar_torus" className="bg-[#121214]">Bipolar Torus</option>
              <option value="lakshmi_star" className="bg-[#121214]">Lakshmi Star</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[8px] tracking-wider text-white/40 uppercase">
              Neon Palette
            </span>
            <select
              value={neonTheme}
              onChange={(e) => {
                audioManager.playSfx('tap_nav', 0.1);
                setNeonTheme(e.target.value as any);
              }}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-mono font-bold tracking-wider text-white focus:outline-none focus:border-[#39FF14]/50 cursor-pointer"
            >
              <option value="cyan_pink" className="bg-[#121214]">Cyber Cyan</option>
              <option value="emerald_orange" className="bg-[#121214]">Toxic Emerald</option>
              <option value="gold_purple" className="bg-[#121214]">Electric Gold</option>
              <option value="rainbow" className="bg-[#121214]">Rainbow Shift</option>
            </select>
          </div>
        </div>

        {/* Playlist Toggle & Active Queue */}
        <div className="flex flex-col border-t border-white/5 pt-3">
          <button
            onClick={() => {
              audioManager.playSfx('tap_nav', 0.1);
              setPlaylistOpen(!playlistOpen);
            }}
            className="flex items-center justify-between font-mono text-[9px] tracking-widest text-[#39FF14] uppercase hover:opacity-80 transition-opacity cursor-pointer py-1"
          >
            <span className="flex items-center gap-1.5">
              <Music size={10} />
              Playlist Queue ({playlist.length} songs)
            </span>
            <span>{playlistOpen ? '▼ HIDE' : '▲ SHOW'}</span>
          </button>

          {playlistOpen && (
            <div className="max-h-[140px] overflow-y-auto mt-2 space-y-1.5 pr-1 custom-scrollbar">
              {playlist.map((track, idx) => {
                const isActive = idx === currentTrackIndex;
                return (
                  <button
                    key={track.id}
                    onClick={() => handleSelectPlaylistTrack(idx)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-[10px] font-mono transition-all border ${
                      isActive
                        ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]'
                        : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="truncate pr-4 uppercase">
                      {idx + 1}. {track.title}
                    </span>
                    <span className="opacity-50 flex-shrink-0">
                      {formatTime(track.duration || 180)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Instruction Footer */}
        <div className="text-center font-mono text-[8px] text-white/30 uppercase tracking-widest">
          {playing ? 'Vibrating on live sound frequencies' : 'Connect soundscape to activate vector peaks'}
        </div>
      </div>
    </div>
  );
}
