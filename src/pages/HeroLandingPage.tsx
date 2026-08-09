/**
 * HeroLandingPage.tsx — Award-Winning Interactive Museum Exhibit Landing Page
 *
 * Visual DNA: Apple Music × Monument Valley × Arcane × Persona 5.
 *
 * Features:
 * - Dynamic Day Switcher Command Palette (⌘K) to preview any song (Day 1 to Current Day).
 * - Strict Looking-Ahead Protection: Blocks viewing future days beyond current day.
 * - 3D Interactive Card Tilt, Holographic Vinyl Disc & Realtime Waveform Canvas.
 * - Interactive Museum Pedestal, Audio Stems, Heatmap Filter Console & Tooltips.
 * - 3D Orbit Ecosystem Constellation & Interactive Pillar Node Inspector Drawer.
 * - Centralized SFX triggers via audioManager.
 *
 * Routes: /hero, /hero/day-:dayParam, /hero/:dayParam
 */

import { useEffect, useState, useRef, useMemo, Fragment, useCallback } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import {
  ChevronDown, Play, Pause, Volume2, Sparkles, X, Info, Disc, ExternalLink, Film,
  Flame, Shield, Layers, Award, Search, Lock, ChevronLeft, ChevronRight, Command, Calendar
} from 'lucide-react';
import { getCurrentDay, getTimeUntilNextDay, formatDate, getDateFromDay } from '../utils/dayCalc';
import { extractPalette, getFallbackPalette, type ExtractedPalette } from '../utils/extractPalette';
import { audioManager } from '../game/audio';
import { useVaultStore } from '../store/useVaultStore';
import { supabase } from '@/services/supabaseClient';
import '../styles/HeroLandingPage.css';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SongEntry {
  id: string;
  day: number;
  title: string;
  artist: string;
  duration: number;
  coverArt: string;
  audioUrl?: string;
  bpm: number;
  mood: string;
}

interface EcosystemPillar {
  id: string;
  label: string;
  desc: string;
  longDesc: string;
  angle: number;
  tag: string;
  stat: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const JOURNEY_STEPS = [
  { icon: '♪', label: 'Song' },
  { icon: '🎮', label: 'Rhythm Level' },
  { icon: '🃏', label: 'Collectible Card' },
  { icon: '📦', label: 'Reward Pack' },
  { icon: '💎', label: 'Shards' },
  { icon: '📚', label: 'Archive' },
];

const STORY_LINES = [
  'Years ago I lost much of my music in a hard drive failure.',
  'I recovered what I could.',
  'Rather than letting those songs disappear...',
  'I decided to release one every day.',
  'Every release becomes something you can play, collect, and remember.',
];

const ECOSYSTEM_NODES: EcosystemPillar[] = [
  { id: '365', label: '365', desc: 'Daily releases', longDesc: '365 original songs composed, mixed, and released across 365 consecutive days.', angle: 270, tag: 'TEMPORAL', stat: '365 TRACKS' },
  { id: 'mood', label: 'Mood', desc: 'Emotional tagging', longDesc: 'High-dimensional valence & mood tagging categorizing tracks from hyper-dark to synth light.', angle: 315, tag: 'VALENCE', stat: '12 MOODS' },
  { id: 'lyrics', label: 'Lyrics', desc: 'Every word', longDesc: 'Complete poetic manuscripts, verse annotations, and hand-crafted lyric sheets.', angle: 0, tag: 'POETRY', stat: 'FULL LYRICS' },
  { id: 'ascii', label: 'ASCII', desc: 'Text art', longDesc: 'Cyber brutalist ASCII typography, retro terminal visuals, and console art.', angle: 45, tag: 'BRUTALIST', stat: 'CLI ART' },
  { id: 'poems', label: 'Poems', desc: 'Verse & flow', longDesc: 'Original spoken word, lyrical prose, and literary companion pieces.', angle: 90, tag: 'LITERARY', stat: 'PROSE' },
  { id: 'lrc', label: 'LRC', desc: 'Synced lyrics', longDesc: 'Millisecond-accurate synced LRC timeline tracks for live karaoke & arcade HUDs.', angle: 135, tag: 'SYNCHRONIZED', stat: 'TIMELINES' },
  { id: 'videos', label: 'Videos', desc: 'Visual stories', longDesc: 'Cinematic visualizers, AI music videos, and generative video backdrops.', angle: 180, tag: 'CINEMATIC', stat: '4K VISUALS' },
  { id: 'base', label: 'Base', desc: 'On-chain proof', longDesc: 'Cryptographic provenance anchored on Base Mainnet. Sovereign collector status.', angle: 225, tag: 'CRYPTOGRAPHIC', stat: 'BASE L2' },
];

const SECTION_IDS = [
  { id: 'hero-top', label: 'PIM' },
  { id: 'hero-drop', label: 'TODAY' },
  { id: 'hero-journey', label: 'FLOW' },
  { id: 'hero-collection', label: '365' },
  { id: 'hero-story', label: 'ORIGIN' },
  { id: 'hero-gameplay', label: 'PROOF' },
  { id: 'hero-ecosystem', label: 'ORBIT' },
  { id: 'hero-stats', label: 'METRICS' },
  { id: 'hero-roadmap', label: 'FUTURE' },
  { id: 'hero-cta', label: 'PLAY' },
];

const ROADMAP_GEN1_FEATURES = ['Stories', 'Audio Forge', 'Weekly Events', 'Community Remixes'];
const ROADMAP_GEN2_FEATURES = ['Creator Platform', 'Upload Your Music', 'Automatic Experiences'];

const CONSTELLATION_RADIUS = 40;
const CONSTELLATION_CENTER = 50;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function songIdFromDay(day: number): string {
  return `day-${String(day).padStart(3, '0')}`;
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Particle Canvas
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

function ParticleCanvas({ palette }: { palette: ExtractedPalette }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const PARTICLE_COUNT = 65;
    const particles: Particle[] = [];

    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w() * dpr;
      canvas.height = h() * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(yOverride?: number): Particle {
      const c = palette.colors[Math.floor(Math.random() * palette.colors.length)];
      const maxLife = 260 + Math.random() * 380;
      return {
        x: Math.random() * w(),
        y: yOverride ?? h() + Math.random() * 20,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(0.2 + Math.random() * 0.5),
        radius: 1 + Math.random() * 2.8,
        color: c.hex,
        alpha: 0,
        life: 0,
        maxLife,
      };
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = spawn(Math.random() * h());
      p.life = Math.random() * p.maxLife;
      particles.push(p);
    }

    function frame() {
      ctx.clearRect(0, 0, w(), h());

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        const ratio = p.life / p.maxLife;
        if (ratio < 0.1) p.alpha = ratio / 0.1;
        else if (ratio > 0.8) p.alpha = (1 - ratio) / 0.2;
        else p.alpha = 1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * 0.6;
        ctx.fill();

        if (p.life >= p.maxLife || p.y < -10) particles[i] = spawn();
      }

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    frame();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [palette]);

  return <canvas ref={canvasRef} className="hero-particles-canvas" />;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Audio Waveform Canvas
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function WaveformCanvas({ isPlaying, accentColor }: { isPlaying: boolean; accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;
    const bars = 24;

    function render() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      phase += 0.08;

      const barWidth = (canvas.width - (bars - 1) * 3) / bars;
      for (let i = 0; i < bars; i++) {
        const heightMultiplier = isPlaying
          ? 0.2 + Math.abs(Math.sin(phase + i * 0.4)) * 0.75 + Math.random() * 0.15
          : 0.1 + Math.abs(Math.sin(i * 0.5)) * 0.15;

        const h = canvas.height * heightMultiplier;
        const x = i * (barWidth + 3);
        const y = (canvas.height - h) / 2;

        ctx.fillStyle = accentColor;
        ctx.globalAlpha = isPlaying ? 0.85 : 0.25;
        ctx.fillRect(x, y, barWidth, h);
      }

      animId = requestAnimationFrame(render);
    }

    render();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, accentColor]);

  return <canvas ref={canvasRef} className="hero-waveform-canvas" width={240} height={24} />;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// StatCounter
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function useCountUp(target: number, duration: number, inView: boolean): number {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!inView || hasAnimated.current) return;
    hasAnimated.current = true;
    const t0 = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);

  return count;
}

function StatCounter({ target, label }: { target: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const count = useCountUp(target, 2200, isInView);

  return (
    <div
      ref={ref}
      className="hero-stat-item"
      onMouseEnter={() => audioManager.playSfx('tap_nav', 0.15)}
    >
      <span className="hero-stat-number">{count.toLocaleString()}</span>
      <span className="hero-stat-label">{label}</span>
    </div>
  );
}

function EcosystemGlobe3D({
  nodes,
  selectedNode,
  onSelectNode,
}: {
  nodes: EcosystemPillar[];
  selectedNode: EcosystemPillar | null;
  onSelectNode: (node: EcosystemPillar) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotX, setRotX] = useState(-12);
  const [rotY, setRotY] = useState(25);
  const [isDragging, setIsDragging] = useState(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastMouseRef.current.x;
    const deltaY = e.clientY - lastMouseRef.current.y;
    setRotY(r => r + deltaX * 0.4);
    setRotX(r => Math.max(-60, Math.min(60, r - deltaY * 0.4)));
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    if (isDragging) return;
    const timer = setInterval(() => {
      setRotY(r => (r + 0.25) % 360);
    }, 30);
    return () => clearInterval(timer);
  }, [isDragging]);

  const radX = (rotX * Math.PI) / 180;
  const radY = (rotY * Math.PI) / 180;
  const RADIUS = 150;

  const nodePositions = useMemo(() => {
    return nodes.map(node => {
      const phi = (node.angle * Math.PI) / 180;
      const theta = (node.angle * 2 * Math.PI) / 180;
      const x0 = RADIUS * Math.cos(phi) * Math.sin(theta);
      const y0 = RADIUS * Math.sin(phi);
      const z0 = RADIUS * Math.cos(phi) * Math.cos(theta);

      const x1 = x0 * Math.cos(radY) + z0 * Math.sin(radY);
      const z1 = -x0 * Math.sin(radY) + z0 * Math.cos(radY);

      const y2 = y0 * Math.cos(radX) - z1 * Math.sin(radX);
      const z2 = y0 * Math.sin(radX) + z1 * Math.cos(radX);

      const scale = (z2 + 250) / 350;
      const opacity = Math.max(0.2, Math.min(1, (z2 + 180) / 300));

      return {
        ...node,
        x: x1,
        y: y2,
        z: z2,
        scale,
        opacity,
      };
    });
  }, [nodes, radX, radY]);

  return (
    <div
      ref={containerRef}
      className="hero-ecosystem-globe-3d-wrap cursor-grab active:cursor-grabbing select-none relative w-full h-[480px] max-w-[700px] mx-auto flex items-center justify-center overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-20">
        <div className="w-[320px] h-[320px] rounded-full border border-white/20 animate-spin-slow" />
        <div className="absolute w-[260px] h-[260px] rounded-full border border-white/10" style={{ transform: 'rotateX(65deg)' }} />
        <div className="absolute w-[260px] h-[260px] rounded-full border border-white/10" style={{ transform: 'rotateY(65deg)' }} />
      </div>

      <div className="relative z-10 w-16 h-16 rounded-full bg-white/5 border border-white/20 backdrop-blur-md flex flex-col items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.15)]">
        <span className="font-mono text-xs font-bold tracking-widest text-white">PIM</span>
        <span className="font-mono text-[8px] uppercase tracking-wider text-white/50">3D ORBIT</span>
      </div>

      {nodePositions.map(node => {
        const isSelected = selectedNode?.id === node.id;
        return (
          <motion.div
            key={node.id}
            className={`absolute cursor-pointer flex flex-col items-center justify-center transition-shadow duration-300 ${
              isSelected ? 'z-40 scale-110' : 'z-20'
            }`}
            style={{
              transform: `translate3d(${node.x}px, ${node.y}px, 0px) scale(${node.scale})`,
              opacity: node.opacity,
              zIndex: Math.round(node.z + 500),
            }}
            onClick={e => {
              e.stopPropagation();
              onSelectNode(node);
              audioManager.playSfx('reveal', 0.4);
            }}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${
                isSelected
                  ? 'bg-white border-white shadow-[0_0_16px_#ffffff]'
                  : 'bg-black/60 border-white/40 shadow-[0_0_8px_rgba(255,255,255,0.2)]'
              }`}
            />
            <span
              className={`mt-1 font-mono text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border backdrop-blur-md transition-all ${
                isSelected
                  ? 'bg-white text-black border-white shadow-lg'
                  : 'bg-black/75 text-white/90 border-white/20'
              }`}
            >
              {node.label}
            </span>
            <span className="font-mono text-[8px] tracking-wider text-white/50 uppercase">{node.tag}</span>
          </motion.div>
        );
      })}

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-widest text-white/30 pointer-events-none">
        [ 3D Orbit • Drag to Rotate ]
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function HeroLandingPage() {
  const params = useParams<{ dayParam?: string }>();
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  const maxAllowedDay = useMemo(() => getCurrentDay(), []); // e.g. Day 213

  // Parse requested day from URL parameter (/hero/day-042, /hero/42, or ?day=42)
  const parsedRequestedDay = useMemo(() => {
    let raw: string | undefined = params.dayParam;
    if (!raw && searchString) {
      const q = new URLSearchParams(searchString);
      raw = q.get('day') || undefined;
    }
    if (!raw) return maxAllowedDay;

    const num = parseInt(raw.replace(/\D/g, ''), 10);
    if (isNaN(num)) return maxAllowedDay;
    return num;
  }, [params.dayParam, searchString, maxAllowedDay]);

  // Enforce STRICT "Block Looking Ahead" rule:
  const { activeDay, isFutureBlocked, attemptedDay } = useMemo(() => {
    if (parsedRequestedDay > maxAllowedDay) {
      return { activeDay: maxAllowedDay, isFutureBlocked: true, attemptedDay: parsedRequestedDay };
    }
    const clamped = Math.max(1, parsedRequestedDay);
    return { activeDay: clamped, isFutureBlocked: false, attemptedDay: parsedRequestedDay };
  }, [parsedRequestedDay, maxAllowedDay]);

  const silentClaimDailyDrop = useVaultStore(state => state.silentClaimDailyDrop);

  const [catalog, setCatalog] = useState<SongEntry[]>([]);
  const [song, setSong] = useState<SongEntry | null>(null);
  const [palette, setPalette] = useState<ExtractedPalette>(getFallbackPalette());
  const [countdown, setCountdown] = useState(getTimeUntilNextDay());
  const [museumVideoUrl, setMuseumVideoUrl] = useState<string | null>(null);

  // Silent Daily Card Claim for Guest / Unauthenticated users accessing today's release
  useEffect(() => {
    if (!activeDay) return;
    silentClaimDailyDrop(activeDay).catch(() => {});
  }, [activeDay, silentClaimDailyDrop]);

  // Command Palette State
  const [isCommandModalOpen, setIsCommandModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive 3D Card Tilt State
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardContainerRef = useRef<HTMLDivElement>(null);

  // Audio Stem Playback State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Collection Heatmap Filter State
  const [filterMode, setFilterMode] = useState<'all' | 'unlocked' | 'dark' | 'light'>('all');
  const [hoveredCardDay, setHoveredCardDay] = useState<number | null>(null);

  // Node Inspector Modal State
  const [selectedNode, setSelectedNode] = useState<EcosystemPillar | null>(null);

  // Scroll Tracking State for Side Nav Dots
  const [activeSection, setActiveSection] = useState<string>('hero-top');

  // Keyboard shortcut for Command Palette (⌘K / Ctrl+K / Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandModalOpen(prev => !prev);
        audioManager.playSfx('tap_nav', 0.3);
      } else if (e.key === 'Escape' && isCommandModalOpen) {
        setIsCommandModalOpen(false);
        audioManager.playSfx('back', 0.3);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandModalOpen]);

  // Load published museum frame-perfect video replay if available
  useEffect(() => {
    if (!song) return;
    const cleanTitle = song.title.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const cachedUrl =
      localStorage.getItem(`museum_video_${cleanTitle}`) ||
      localStorage.getItem(`museum_video_day_${song.day}`) ||
      localStorage.getItem(`museum_video_song_${song.id}`) ||
      localStorage.getItem('museum_video_latest');

    if (cachedUrl) {
      setMuseumVideoUrl(cachedUrl);
    } else {
      supabase
        .from('museum_videos')
        .select('video_url')
        .eq('song_title', song.title)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.video_url) {
            setMuseumVideoUrl(data.video_url);
            localStorage.setItem(`museum_video_${cleanTitle}`, data.video_url);
          } else {
            setMuseumVideoUrl(null);
          }
        })
        .catch(() => setMuseumVideoUrl(null));
    }
  }, [song]);

  // Load catalog & update current song when activeDay changes
  useEffect(() => {
    fetch('/data/song_catalog.json')
      .then(r => r.json())
      .then((data: SongEntry[]) => {
        setCatalog(data);
        const currentSong = data.find(s => s.day === activeDay) || data[data.length - 1];
        setSong(currentSong);

        if (currentSong?.coverArt) {
          extractPalette(currentSong.coverArt).then(setPalette).catch(() => {});
        }

        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlayingAudio(false);
        }

        if (currentSong?.audioUrl) {
          audioRef.current = new Audio(currentSong.audioUrl);
          audioRef.current.loop = true;
        }
      })
      .catch(console.error);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [activeDay]);

  // Countdown Tick
  useEffect(() => {
    const id = setInterval(() => setCountdown(getTimeUntilNextDay()), 1000);
    return () => clearInterval(id);
  }, []);

  // Section Observer for Side Nav
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.4 }
    );

    SECTION_IDS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Handle 3D Mouse Tilt
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardContainerRef.current) return;
    const rect = cardContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * 24, y: -x * 24 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  // Toggle Audio Stem Playback
  const toggleAudio = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
      audioManager.playSfx('pause', 0.3);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlayingAudio(true);
      audioManager.playSfx('select_start_song', 0.4);
    }
  }, [isPlayingAudio]);

  // Switch Day Handler
  const songByDayMap = useMemo(() => {
    const map = new Map<number, SongEntry>();
    catalog.forEach(s => map.set(s.day, s));
    return map;
  }, [catalog]);

  const jumpToDay = useCallback(
    (targetDay: number) => {
      if (targetDay > maxAllowedDay) {
        audioManager.playSfx('locked_out', 0.5);
        return;
      }
      const validDay = Math.max(1, Math.min(maxAllowedDay, targetDay));
      audioManager.playSfx('tap_nav', 0.3);
      setLocation(`/hero/day-${validDay}`);
      setIsCommandModalOpen(false);
    },
    [maxAllowedDay, setLocation]
  );

  const activeDateStr = useMemo(() => {
    const d = getDateFromDay(activeDay);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, [activeDay]);

  const songId = songIdFromDay(activeDay);

  const rootStyle = useMemo(
    () =>
      ({
        '--palette-dominant': palette.dominant.hex,
        '--palette-secondary': palette.secondary.hex,
        '--palette-accent': palette.accent.hex,
        '--palette-muted': palette.muted.hex,
        '--palette-dark': palette.dark.hex,
      }) as React.CSSProperties,
    [palette]
  );

  const countdownStr = `${String(countdown.hours).padStart(2, '0')}:${String(countdown.minutes).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`;

  const filteredCommandCatalog = useMemo(() => {
    const unlocked = catalog.filter(s => s.day <= maxAllowedDay);
    if (!searchQuery.trim()) return unlocked;
    const q = searchQuery.toLowerCase();
    return unlocked.filter(
      s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        String(s.day) === q ||
        `day ${s.day}`.includes(q) ||
        s.mood.toLowerCase().includes(q)
    );
  }, [catalog, maxAllowedDay, searchQuery]);

  const progressRef = useRef<HTMLDivElement>(null);
  const progressInView = useInView(progressRef, { once: true, margin: '-60px' });

  const roadmapRef = useRef<HTMLDivElement>(null);
  const roadmapInView = useInView(roadmapRef, { once: true, margin: '-60px' });

  return (
    <div className="hero-landing" style={rootStyle}>
      {/* Noise Texture & Shader Beams */}
      <div className="hero-noise-overlay" />
      <div className="hero-ambient-beams">
        <div className="hero-beam-1" />
        <div className="hero-beam-2" />
        <div className="hero-beam-3" />
      </div>

      {/* Future Day Lock Warning Banner */}
      <AnimatePresence>
        {isFutureBlocked && (
          <motion.div
            className="hero-future-banner"
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
          >
            <Lock size={14} />
            <span>
              <strong>FUTURE TRANSMISSION LOCKED:</strong> Day {attemptedDay} is not released yet. Clamped to Day {maxAllowedDay}.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side Scroll Navigation Dots */}
      <div className="hero-side-nav">
        {SECTION_IDS.map(sec => (
          <a
            key={sec.id}
            href={`#${sec.id}`}
            className={`hero-nav-dot ${activeSection === sec.id ? 'active' : ''}`}
            onClick={() => audioManager.playSfx('tap_nav', 0.2)}
          >
            <span className="hero-nav-tooltip">{sec.label}</span>
          </a>
        ))}
      </div>

      {/* ═══════════ SECTION 1 : HERO VIEWPORT ═══════════ */}
      <section className="hero-viewport" id="hero-top">
        {song?.coverArt && (
          <div
            className="hero-artwork-bg"
            style={{ backgroundImage: `url(${song.coverArt})` }}
          />
        )}
        <ParticleCanvas palette={palette} />
        <div className="hero-vignette" />

        <motion.div
          className="hero-content-glass"
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, ease: EASE_OUT }}
        >
          <h1 className="hero-title-pim">PIM</h1>
          <p className="hero-title-subtitle">Poetry In Motion</p>

          <p className="hero-tagline">
            One Original Song.
            <br />
            Every Single Day.
          </p>

          <p className="hero-actions-line">
            Listen · Play · Collect · Return Tomorrow
          </p>

          <div className="flex flex-col items-center gap-2 mb-4">
            <Link 
              href={`/play/${songId}`} 
              onClick={() => {
                audioManager.playSfx('select_start_song', 0.5);
                silentClaimDailyDrop(activeDay);
              }}
            >
              <span className="hero-play-btn">
                <Play size={14} fill="#000" /> PLAY DAY {activeDay} DROP
              </span>
            </Link>
            {import.meta.env.DEV && (
              <button
                onClick={() => {
                  sessionStorage.setItem(`export_video_${songId}`, 'true');
                  audioManager.playSfx('select_start_song', 0.5);
                  setLocation(`/play/${songId}`);
                }}
                title="Export frame-perfect 100% PERFECT+ run video (DEV ONLY)"
                className="mt-1 px-4 py-2 bg-[#FF1493]/15 border border-[#FF1493] text-[#FF1493] rounded-full text-[10px] font-mono font-bold uppercase tracking-widest transition-all hover:bg-[#FF1493] hover:text-black shadow-[0_0_12px_rgba(255,20,147,0.25)] flex items-center gap-1.5 cursor-pointer"
              >
                <Film size={12} />
                <span>EXPORT PERFECT VIDEO</span>
              </button>
            )}
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 border-t border-b border-white/10 py-1 px-6 mt-1">
              ─────────────── No account required ───────────────
            </div>
          </div>

          {/* Day Stepper & Command Palette Trigger */}
          <div className="flex justify-center">
            <div className="hero-day-stepper">
              <button
                disabled={activeDay <= 1}
                onClick={() => jumpToDay(activeDay - 1)}
                className="hero-stepper-btn"
                title="Previous Day"
              >
                <ChevronLeft size={14} />
              </button>

              <button
                onClick={() => {
                  setIsCommandModalOpen(true);
                  audioManager.playSfx('tap_nav', 0.3);
                }}
                className="hero-stepper-trigger"
                title="Open Day Selector Command Palette (⌘K)"
              >
                <Calendar size={12} />
                <span>{song ? formatDate(song.day) : `Day ${activeDay}`}</span>
                <Command size={11} className="opacity-60" />
              </button>

              <button
                disabled={activeDay >= maxAllowedDay}
                onClick={() => jumpToDay(activeDay + 1)}
                className="hero-stepper-btn"
                title={activeDay >= maxAllowedDay ? 'Future day locked' : 'Next Day'}
              >
                {activeDay >= maxAllowedDay ? <Lock size={12} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        </motion.div>

        <a href="#hero-drop" className="hero-scroll-hint" onClick={() => audioManager.playSfx('tap_nav', 0.2)}>
          <ChevronDown size={22} strokeWidth={1.5} />
        </a>
      </section>

      {/* ═══════════ SECTION 2 : TODAY'S DROP & VINYL PEDESTAL ═══════════ */}
      <section className="hero-drop-section" id="hero-drop">
        <div className="hero-pedestal-stage">
          <motion.div
            ref={cardContainerRef}
            className="hero-drop-artwork-container"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
            onClick={toggleAudio}
          >
            <div className="hero-drop-glow" />

            <div className={`hero-vinyl-disc ${isPlayingAudio ? 'playing' : ''}`}>
              {song?.coverArt && (
                <div
                  className="hero-vinyl-label"
                  style={{ backgroundImage: `url(${song.coverArt})` }}
                />
              )}
            </div>

            <div className="hero-drop-artwork-card">
              <div className="hero-specular-glare" />
              {song?.coverArt && (
                <img
                  src={song.coverArt}
                  alt={`${song.title} artwork`}
                  className="hero-drop-artwork-img"
                  loading="lazy"
                />
              )}
            </div>
          </motion.div>

          <div className="hero-waveform-wrap">
            <button
              onClick={toggleAudio}
              className="p-1 rounded text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              {isPlayingAudio ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <WaveformCanvas isPlaying={isPlayingAudio} accentColor={palette.dominant.hex} />
            <span className="font-mono text-[9px] text-white/40 tracking-widest uppercase">
              {isPlayingAudio ? 'LIVE PREVIEW' : 'CLICK TO LISTEN'}
            </span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7, delay: 0.15 }}
          style={{ textAlign: 'center' }}
        >
          <p className="hero-drop-meta">
            {activeDay === maxAllowedDay ? "Today's Drop" : `Day ${activeDay} Archive`}
          </p>
          <h2 className="hero-drop-title">&ldquo;{song?.title || 'Loading...'}&rdquo;</h2>
          <p className="hero-drop-meta">
            {song ? formatDuration(song.duration) : '--:--'} · by {song?.artist || 'th3scr1b3'} · {song?.bpm || 120} BPM
          </p>
        </motion.div>

        <motion.div
          className="hero-drop-actions"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <button
            onClick={() => {
              toggleAudio();
              audioManager.playSfx('tap_nav', 0.3);
            }}
            className={`hero-drop-action-btn ${isPlayingAudio ? 'active' : ''}`}
          >
            {isPlayingAudio ? <Pause size={14} /> : <Play size={14} />} {isPlayingAudio ? 'Pause Stem' : '▶ Listen'}
          </button>
          <Link href={`/play/${songId}`} onClick={() => audioManager.playSfx('select_start_song', 0.5)}>
            <span className="hero-drop-action-btn">🎮 Play Level</span>
          </Link>
          <Link href={`/song/${songId}`} onClick={() => audioManager.playSfx('tap_nav', 0.3)}>
            <span className="hero-drop-action-btn">🃏 View Card</span>
          </Link>
        </motion.div>
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 3 : THE JOURNEY ═══════════ */}
      <section className="hero-journey-section" id="hero-journey">
        <motion.p
          className="hero-journey-title"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.45 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          One song becomes...
        </motion.p>

        <div className="hero-journey-steps">
          {JOURNEY_STEPS.map((step, i) => (
            <Fragment key={step.label}>
              <motion.div
                className="hero-journey-step"
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                onMouseEnter={() => audioManager.playSfx('tap_nav', 0.15)}
              >
                <span className="hero-journey-icon">{step.icon}</span>
                <span className="hero-journey-label">{step.label}</span>
              </motion.div>
              {i < JOURNEY_STEPS.length - 1 && (
                <motion.div
                  className="hero-journey-arrow"
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.12 + 0.08 }}
                  style={{ transformOrigin: 'top' }}
                />
              )}
            </Fragment>
          ))}
        </div>
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 4 : THE COLLECTION HEATMAP ═══════════ */}
      <section className="hero-collection-section" id="hero-collection" ref={progressRef}>
        <motion.h2
          className="hero-collection-header"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          365 Days
        </motion.h2>

        <div className="hero-progress-bar-wrap">
          <div
            className="hero-progress-bar-fill"
            style={{ width: progressInView ? `${(maxAllowedDay / 365) * 100}%` : '0%' }}
          />
        </div>

        <p className="hero-progress-label">{maxAllowedDay} / 365 RELEASES UNLOCKED</p>

        {/* Dark / Light Mood Legend */}
        {/* Dark / Light Mood Legend — Pure Dynamic Artwork Palette */}
        <div className="flex items-center gap-6 mb-6 font-mono text-[10px] tracking-widest uppercase opacity-85">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--palette-dominant)' }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--palette-dominant)', boxShadow: '0 0 8px var(--palette-dominant)' }} />
            🌑 Dark Moods
          </span>
          <span className="flex items-center gap-1.5" style={{ color: 'var(--palette-accent)' }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--palette-accent)', boxShadow: '0 0 8px var(--palette-accent)' }} />
            ☀️ Light Moods
          </span>
        </div>

        {/* Heatmap Filter Chips */}
        <div className="hero-collection-filters">
          {(['all', 'unlocked', 'dark', 'light'] as const).map(mode => (
            <button
              key={mode}
              className={`hero-filter-chip ${filterMode === mode ? 'active' : ''}`}
              onClick={() => {
                setFilterMode(mode);
                audioManager.playSfx('tap_nav', 0.2);
              }}
            >
              {mode === 'dark' ? '🌑 DARK' : mode === 'light' ? '☀️ LIGHT' : mode.toUpperCase()}
            </button>
          ))}
        </div>

        <motion.div
          className="hero-card-grid"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {Array.from({ length: 365 }, (_, i) => {
            const day = i + 1;
            const isSelected = day === activeDay;
            const isFilled = day <= maxAllowedDay;
            const daySong = songByDayMap.get(day);
            const mood = daySong?.mood?.toLowerCase() === 'light' ? 'light' : 'dark';

            // Filter modes
            const matchesFilter =
              filterMode === 'all'
                ? true
                : filterMode === 'unlocked'
                ? isFilled
                : filterMode === 'dark'
                ? mood === 'dark'
                : filterMode === 'light'
                ? mood === 'light'
                : true;

            if (filterMode === 'unlocked' && !isFilled) return null;

            const isDimmed = !matchesFilter;

            return (
              <div
                key={day}
                className={`hero-grid-cell ${
                  isSelected
                    ? 'hero-grid-cell--today'
                    : isFilled
                    ? mood === 'light'
                      ? 'hero-grid-cell--filled hero-grid-cell--light'
                      : 'hero-grid-cell--filled hero-grid-cell--dark'
                    : 'hero-grid-cell--empty'
                } ${isDimmed ? 'hero-grid-cell--dimmed' : ''}`}
                style={
                  isFilled && !isSelected
                    ? ({ '--shimmer-delay': `${(i % 20) * 0.15}s` } as React.CSSProperties)
                    : undefined
                }
                onMouseEnter={() => {
                  setHoveredCardDay(day);
                  audioManager.playSfx('tap_nav', 0.05);
                }}
                onMouseLeave={() => setHoveredCardDay(null)}
                onClick={() => {
                  if (isFilled) {
                    jumpToDay(day);
                  } else {
                    audioManager.playSfx('locked_out', 0.5);
                  }
                }}
                title={isFilled ? `Day ${day} — Click to view landing page` : `Day ${day} (Locked)`}
              />
            );
          })}
        </motion.div>

        <div className="h-6 mt-4 font-mono text-[10px] text-white/50 tracking-widest uppercase flex items-center gap-2">
          {hoveredCardDay ? (
            <>
              <span className={hoveredCardDay <= maxAllowedDay ? 'text-[#39FF14] font-bold' : 'text-red-500 font-bold'}>
                DAY {hoveredCardDay}
              </span>
              <span>·</span>
              <span>
                {hoveredCardDay <= maxAllowedDay
                  ? hoveredCardDay === activeDay
                    ? 'CURRENTLY PREVIEWING LANDING PAGE'
                    : 'CLICK TO LOAD LANDING PAGE'
                  : '🔒 LOCKED IN THE FUTURE'}
              </span>
            </>
          ) : (
            <span className="opacity-40">CLICK ANY UNLOCKED SQUARE TO LOAD THAT DAY&apos;S LANDING PAGE</span>
          )}
        </div>
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 5 : THE STORY ═══════════ */}
      <section className="hero-story-section" id="hero-story">
        {STORY_LINES.map((line, i) => (
          <motion.p
            key={i}
            className="hero-story-line"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 0.85, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.7, delay: i * 0.14, ease: EASE_OUT }}
          >
            {i === 3 ? (
              <>
                I decided to release <span className="hero-story-highlight">one every day</span>.
              </>
            ) : (
              line
            )}
          </motion.p>
        ))}
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 6 : GAMEPLAY PROOF ═══════════ */}
      <section className="hero-gameplay-section relative" id="hero-gameplay">
        <motion.div
          className={`hero-gameplay-wrap relative overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl group ${
            museumVideoUrl ? 'hero-gameplay-museum-mode' : ''
          }`}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        >
          {museumVideoUrl ? (
            <div className="relative w-full flex flex-col items-center justify-center bg-slate-950/90 p-3 sm:p-5 rounded-3xl">
              <div className="relative w-full flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black shadow-inner">
                <video
                  src={museumVideoUrl}
                  autoPlay
                  loop
                  muted
                  controls
                  playsInline
                  className="w-full max-h-[82vh] object-contain rounded-2xl"
                />
                
                {/* Live Frame-Perfect Status Badge */}
                <div className="absolute top-4 left-4 z-20 px-3.5 py-1.5 rounded-xl bg-black/85 border border-[#39FF14]/70 text-[#39FF14] font-mono text-[10px] font-black tracking-widest flex items-center gap-2 uppercase shadow-[0_0_20px_rgba(57,255,20,0.4)] backdrop-blur-md pointer-events-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#39FF14] animate-ping" />
                  <span>FRAME-PERFECT 100% PERFECT+ EXHIBIT REPLAY // DAY {activeDay}</span>
                </div>
              </div>
            </div>
          ) : (
            <img
              src="/screenshots/06_rhythm_gameplay.png"
              alt="PIM rhythm gameplay — perfect run"
              className="hero-gameplay-media hero-gameplay-ken-burns"
              loading="lazy"
            />
          )}
        </motion.div>

        <motion.div
          className="hero-gameplay-label flex flex-col sm:flex-row items-center justify-center gap-3 mt-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <span className="text-white/60 font-mono text-xs">
            Perfect Run · Day {activeDay} ({song?.title || 'Transmission'})
          </span>
          {museumVideoUrl && (
            <div className="flex items-center gap-2">
              <span className="text-[#39FF14] font-mono text-[10px] font-black uppercase tracking-wider bg-[#39FF14]/10 border border-[#39FF14]/40 px-2.5 py-1 rounded-md">
                [LIVE VIDEO EXPORT EXHIBIT]
              </span>
              <button
                onClick={() => {
                  localStorage.removeItem('museum_video_latest');
                  if (song) {
                    const cleanTitle = song.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    localStorage.removeItem(`museum_video_${cleanTitle}`);
                  }
                  setMuseumVideoUrl(null);
                }}
                className="text-xs text-slate-400 hover:text-red-400 font-mono uppercase tracking-wider transition-colors cursor-pointer"
                title="Reset exhibit view to default screenshot preview"
              >
                [RESET EXHIBIT VIEW]
              </button>
            </div>
          )}
        </motion.div>
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 7 : 3D ORBITAL ECOSYSTEM ═══════════ */}
      <section className="hero-ecosystem-section" id="hero-ecosystem">
        <EcosystemGlobe3D
          nodes={ECOSYSTEM_NODES}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
        />

        {/* Ecosystem Node Inspector Modal */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              className="hero-node-drawer"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="font-mono text-[9px] text-[#00E5FF] tracking-widest uppercase font-bold">
                    {selectedNode.tag} // {selectedNode.stat}
                  </span>
                  <h3 className="text-xl font-black font-mono text-white uppercase tracking-wider">
                    {selectedNode.label}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedNode(null);
                    audioManager.playSfx('back', 0.3);
                  }}
                  className="text-white/40 hover:text-white transition-colors cursor-pointer p-1"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="font-mono text-xs text-white/70 leading-relaxed mb-4">
                {selectedNode.longDesc}
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setSelectedNode(null);
                    audioManager.playSfx('tap_nav', 0.3);
                  }}
                  className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 8 : LIVE STATISTICS ═══════════ */}
      <section className="hero-stats-section" id="hero-stats">
        <motion.div
          className="hero-stats-grid"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7 }}
        >
          <StatCounter target={activeDay} label="Songs Released" />
          <StatCounter target={activeDay} label="Playable Levels" />
          <StatCounter target={activeDay} label="Cards" />
          <StatCounter target={47291} label="Notes Played Today" />
          <StatCounter target={1432} label="Packs Opened" />
        </motion.div>
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 9 : ROADMAP ═══════════ */}
      <section className="hero-roadmap-section" id="hero-roadmap" ref={roadmapRef}>
        <motion.p
          className="hero-roadmap-title"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.4 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          Roadmap
        </motion.p>

        <motion.div
          className="hero-roadmap-timeline"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8 }}
        >
          <div className="hero-roadmap-gen">
            <div className="hero-roadmap-dot" />
            <p className="hero-roadmap-gen-title">Generation 0</p>
            <div className="hero-roadmap-bar-wrap">
              <div
                className="hero-roadmap-bar-fill"
                style={{ width: roadmapInView ? `${(maxAllowedDay / 365) * 100}%` : '0%' }}
              />
            </div>
            <p className="hero-roadmap-bar-label">Day {maxAllowedDay} / 365 Active</p>
          </div>

          <div className="hero-roadmap-gen">
            <div className="hero-roadmap-dot hero-roadmap-dot--inactive" />
            <p className="hero-roadmap-gen-title" style={{ opacity: 0.6 }}>
              Generation 1
            </p>
            <div className="hero-roadmap-features">
              {ROADMAP_GEN1_FEATURES.map(f => (
                <span key={f} className="hero-roadmap-feature">
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="hero-roadmap-gen">
            <div className="hero-roadmap-dot hero-roadmap-dot--inactive" />
            <p className="hero-roadmap-gen-title" style={{ opacity: 0.4 }}>
              Generation 2
            </p>
            <div className="hero-roadmap-features">
              {ROADMAP_GEN2_FEATURES.map(f => (
                <span key={f} className="hero-roadmap-feature">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════════ SECTION 10 : BOTTOM CTA ═══════════ */}
      <section className="hero-cta-section" id="hero-cta">
        <motion.p
          className="hero-cta-text"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 0.6, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          Today&apos;s song disappears into history tomorrow.
        </motion.p>

        <motion.p
          className="hero-cta-day"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          Experience Day {activeDay}.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <Link href={`/play/${songId}`} onClick={() => audioManager.playSfx('select_start_song', 0.6)}>
            <span className="hero-play-btn">
              <Play size={16} fill="#000" /> Play Day {activeDay}
            </span>
          </Link>
        </motion.div>

        <motion.p
          className="hero-cta-countdown"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.35 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          Next drop in {countdownStr}
        </motion.p>
      </section>

      {/* ═══════════ DAY SELECTOR COMMAND PALETTE MODAL ═══════════ */}
      <AnimatePresence>
        {isCommandModalOpen && (
          <motion.div
            className="hero-command-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setIsCommandModalOpen(false);
              audioManager.playSfx('back', 0.3);
            }}
          >
            <motion.div
              className="hero-command-modal"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              onClick={e => e.stopPropagation()}
            >
              <div className="hero-command-header">
                <Search size={18} className="text-white/40" />
                <input
                  type="text"
                  placeholder="Jump to Day # or Search Title/Artist..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="hero-command-input"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setIsCommandModalOpen(false);
                    audioManager.playSfx('back', 0.3);
                  }}
                  className="text-white/40 hover:text-white p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="hero-command-quick-actions">
                <button onClick={() => jumpToDay(maxAllowedDay)} className="hero-quick-tag">
                  ⚡ Today (Day {maxAllowedDay})
                </button>
                <button onClick={() => jumpToDay(1)} className="hero-quick-tag">
                  🌅 Day 1 (Launch)
                </button>
                <button
                  onClick={() => {
                    const rnd = Math.floor(Math.random() * maxAllowedDay) + 1;
                    jumpToDay(rnd);
                  }}
                  className="hero-quick-tag"
                >
                  🎲 Random Day
                </button>
              </div>

              <div className="hero-command-list">
                {filteredCommandCatalog.map(s => (
                  <div
                    key={s.id}
                    className={`hero-command-item ${s.day === activeDay ? 'active' : ''}`}
                    onClick={() => jumpToDay(s.day)}
                  >
                    <img src={s.coverArt} alt={s.title} className="hero-command-thumb" />
                    <div className="hero-command-meta">
                      <span className="hero-command-title">{s.title}</span>
                      <span className="hero-command-sub">
                        Day {s.day} · {s.artist}
                      </span>
                    </div>
                  </div>
                ))}
                {filteredCommandCatalog.length === 0 && (
                  <div className="col-span-full py-12 text-center font-mono text-xs text-white/40 uppercase">
                    No matching songs found in unlocked catalog.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
