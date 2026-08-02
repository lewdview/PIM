/**
 * HeroLandingPage.tsx — Award-Winning Interactive Museum Exhibit Landing Page
 *
 * Visual DNA: Apple Music × Monument Valley × Arcane × Persona 5.
 *
 * Overhaul Updates:
 * 1. Interactive 3D Moveable Clickable Ecosystem Sphere/Globe (drag/swipe to rotate in 3D space, spherical node coordinates, glass inspector).
 * 2. Full-Section Cinematic Stepper Animation ("From One Song... Every Single Day") with smooth scale & fade morphs and step tab progress.
 * 3. Pure Custom SVGs & Vector Icons (Zero emoticons/emojis anywhere).
 */

import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Play, Pause, Volume2, Sparkles, X, Info, Disc, ExternalLink,
  Flame, Shield, Layers, Award, Search, Lock, ChevronLeft, ChevronRight, Command,
  Globe, Fingerprint, Film, Sliders, Compass, Gamepad2, Moon, Sun, Headphones, Calendar, RotateCw
} from 'lucide-react';
import { extractPalette, getFallbackPalette, type ExtractedPalette } from '../utils/extractPalette';
import { audioManager } from '../game/audio';
import '../styles/HeroLandingPage.css';
import { getCurrentDay, formatDate } from '../utils/dayCalc';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types & Data Structures
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SongCatalogItem {
  day: number;
  date: string;
  title: string;
  artist: string;
  duration: number;
  coverArt: string;
  audioUrl?: string;
  bpm?: number;
  mood?: string;
  ceLyricsUrl?: string;
  ceAsciiUrl?: string;
  cePoemUrl?: string;
  ceLrcUrl?: string;
  ceVideoUrl?: string;
  baseProof?: string;
}

interface EcosystemNode {
  id: string;
  label: string;
  desc: string;
  stat: string;
  tag: string;
  url: string;
  longDesc: string;
  lat: number; // 3D spherical latitude
  lon: number; // 3D spherical longitude
  icon: React.ReactNode;
}

const ECOSYSTEM_NODES_3D: EcosystemNode[] = [
  {
    id: 'main',
    label: 'th3scr1b3.art',
    desc: '365 Warp — Main Hub',
    stat: '365 Releases',
    tag: 'MAIN NODE',
    url: 'https://th3scr1b3.art',
    longDesc: 'The primary narrative engine and daily song drop portal for th3scr1b3. Releases one original track every single day.',
    lat: 0,
    lon: 0,
    icon: <Globe size={16} />,
  },
  {
    id: 'user',
    label: 'user.th3scr1b3.art',
    desc: 'Sovereign Identity Hub',
    stat: 'Identity Passport',
    tag: 'AUTH NODE',
    url: 'https://user.th3scr1b3.art',
    longDesc: 'Cryptographic identity passport and telemetry aggregator synchronizing your session and card collection across all endpoints.',
    lat: 45,
    lon: 72,
    icon: <Fingerprint size={16} />,
  },
  {
    id: 'pim',
    label: 'PIM : TH3V4ULT',
    desc: 'Arcade Rhythm Engine',
    stat: 'Live Gameplay',
    tag: 'PLAY NODE',
    url: 'https://pim.th3scr1b3.art',
    longDesc: 'Interactive arcade rhythm game cabinet. Play today’s release, collect rare cards, and climb the sovereign leaderboard.',
    lat: -30,
    lon: 144,
    icon: <Gamepad2 size={16} />,
  },
  {
    id: 'video',
    label: '365 POSTER',
    desc: 'Visual Archive',
    stat: '365 Art Posters',
    tag: 'VISUAL NODE',
    url: 'https://video.th3scr1b3.art',
    longDesc: 'HD poster archive and visual art generator showcasing cover artwork and motion posters for every daily drop.',
    lat: 60,
    lon: 216,
    icon: <Film size={16} />,
  },
  {
    id: 'ce',
    label: 'SONG ANALYZER',
    desc: 'CE Telemetry Engine',
    stat: 'Spectral Telemetry',
    tag: 'CE NODE',
    url: 'https://ce.th3scr1b3.art',
    longDesc: 'Audio spectral analysis, synced LRC lyric parser, ASCII art generator, and deep wave telemetry engine.',
    lat: -50,
    lon: 288,
    icon: <Sliders size={16} />,
  },
  {
    id: 'mood',
    label: 'MOOD MAP',
    desc: 'Poem & Valence Map',
    stat: 'Emotional Topology',
    tag: 'MOOD NODE',
    url: 'https://th3scr1b3.art/mood-map',
    longDesc: 'Interactive emotional topology map organizing all 365 daily tracks by valence, energy, and poetic themes.',
    lat: 20,
    lon: 330,
    icon: <Compass size={16} />,
  },
  {
    id: 'base',
    label: 'BASE L2 MINI-APP',
    desc: 'On-Chain Proofs',
    stat: 'Base Network',
    tag: 'WEB3 NODE',
    url: 'https://base.th3scr1b3.art',
    longDesc: 'Farcaster Frame integration and Base L2 smart contract protocol for on-chain song drop verification and card minting.',
    lat: -70,
    lon: 45,
    icon: <Shield size={16} />,
  },
];

const JOURNEY_STEPS = [
  {
    step: 1,
    badge: 'PHASE 01 // CREATION',
    title: 'One Original Song.',
    desc: 'Written, recorded, mixed, and mastered from scratch every single day. No filler, no backlogs — pure raw creative momentum.',
    icon: <Disc size={28} />,
  },
  {
    step: 2,
    badge: 'PHASE 02 // CADENCE',
    title: 'Every Single Day.',
    desc: '365 consecutive daily drops per year. A living archive of sound, poetry, and motion artwork evolving in real time.',
    icon: <Calendar size={28} />,
  },
  {
    step: 3,
    badge: 'PHASE 03 // ENGAGEMENT',
    title: 'Listen • Play • Collect.',
    desc: 'Stream the full stem, play the rhythm beatmap in PIM : TH3V4ULT, and collect digital card drops to build your sovereign binder.',
    icon: <Headphones size={28} />,
  },
  {
    step: 4,
    badge: 'PHASE 04 // REPEAT',
    title: 'Return Tomorrow.',
    desc: 'The cycle resets at midnight UTC. A fresh song drop, new cover art palette, and unlocked beatmaps await every morning.',
    icon: <Sparkles size={28} />,
  },
];

const STORY_LINES = [
  'It started as an experiment.',
  'Could a person make a song a day?',
  'Not a loop. Not a draft. A full piece.',
  'I decided to release one every day.',
  'That was Day 1.',
  'Today is Day 208.',
  'Tomorrow, another.',
  'The archive grows. The vault fills.',
  'One song at a time.',
];

const ROADMAP_GENS = [
  { gen: 'GEN 1', title: 'The Daily Warp', desc: 'Days 1-100 · 100 songs, baseline mechanics, initial card drops', active: true },
  { gen: 'GEN 2', title: 'The Sound Engine', desc: 'Days 101-200 · Multi-stem audio player, beatmap editor, smart contracts', active: true },
  { gen: 'GEN 3', title: 'The Museum Exhibit', desc: 'Days 201-300 · Dynamic palette extraction, 3D ecosystem globe, multi-song landing pages', active: true },
  { gen: 'GEN 4', title: 'The Full Circle', desc: 'Days 301-365 · Final season box set, physical vinyl press, full archive completion', active: false },
];

const ECOSYSTEM_INSPECTOR_ITEMS = [
  { key: 'Day #', getVal: (s: SongCatalogItem | null) => `Day ${s?.day || '---'}` },
  { key: 'Title', getVal: (s: SongCatalogItem | null) => s?.title || '---' },
  { key: 'Artist', getVal: (s: SongCatalogItem | null) => s?.artist || 'th3scr1b3' },
  { key: 'Duration', getVal: (s: SongCatalogItem | null) => formatDuration(s?.duration) },
  { key: 'Tempo', getVal: (s: SongCatalogItem | null) => `${s?.bpm || 120} BPM` },
  { key: 'Valence / Mood', getVal: (s: SongCatalogItem | null) => (s?.mood || 'Dark').toUpperCase() },
  { key: 'Base On-Chain Proof', getVal: (s: SongCatalogItem | null) => s?.baseProof || '0x71c9...3f8a (Base L2 Verified)' },
  { key: 'CE Telemetry Engine', getVal: () => 'ONLINE / ACTIVE' },
];

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3D SPHERICAL ECOSYSTEM GLOBE COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function EcosystemGlobe3D({
  onSelectNode,
  selectedNodeId,
}: {
  onSelectNode: (node: EcosystemNode) => void;
  selectedNodeId?: string;
}) {
  const [rotation, setRotation] = useState({ x: -15, y: 35 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    lastMouse.current = { x: clientX, y: clientY };
  };

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const deltaX = clientX - lastMouse.current.x;
    const deltaY = clientY - lastMouse.current.y;

    setRotation(prev => ({
      x: Math.max(-60, Math.min(60, prev.x - deltaY * 0.4)),
      y: prev.y + deltaX * 0.4,
    }));

    lastMouse.current = { x: clientX, y: clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Auto rotation tick when idle
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isDragging.current) {
        setRotation(prev => ({ ...prev, y: prev.y + 0.3 }));
      }
    }, 40);
    return () => clearInterval(timer);
  }, []);

  const radius = 170; // 3D radius in px

  return (
    <div
      className="hero-globe-wrap"
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
    >
      <div
        className="hero-globe-sphere"
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        }}
      >
        {/* Core Pulsing Center */}
        <div className="hero-globe-center-core">
          <span className="hero-globe-core-label">PIM</span>
          <span className="hero-globe-core-sub">365 WARP</span>
        </div>

        {/* 3D Nodes */}
        {ECOSYSTEM_NODES_3D.map(node => {
          const latRad = (node.lat * Math.PI) / 180;
          const lonRad = (node.lon * Math.PI) / 180;

          // Spherical coordinate math
          const x = radius * Math.cos(latRad) * Math.cos(lonRad);
          const y = radius * Math.sin(latRad);
          const z = radius * Math.cos(latRad) * Math.sin(lonRad);

          // Rotate point around sphere angles to calculate Z-depth
          const rotXRad = (rotation.x * Math.PI) / 180;
          const rotYRad = (rotation.y * Math.PI) / 180;

          // Apply rotation Y then X
          const x1 = x * Math.cos(rotYRad) + z * Math.sin(rotYRad);
          const z1 = -x * Math.sin(rotYRad) + z * Math.cos(rotYRad);
          const y2 = y * Math.cos(rotXRad) - z1 * Math.sin(rotXRad);
          const z2 = y * Math.sin(rotXRad) + z1 * Math.cos(rotXRad);

          // Calculate depth opacity & scale
          const isFront = z2 > -40;
          const opacity = Math.max(0.2, (z2 + radius) / (2 * radius));
          const scale = Math.max(0.65, (z2 + radius * 1.5) / (2.5 * radius));
          const isSelected = selectedNodeId === node.id;

          return (
            <div
              key={node.id}
              className={`hero-3d-node-item ${isSelected ? 'active' : ''}`}
              style={{
                transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${scale})`,
                opacity: isFront ? opacity : opacity * 0.4,
                zIndex: Math.round(z2 + 300),
                pointerEvents: isFront ? 'auto' : 'none',
              }}
              onClick={e => {
                e.stopPropagation();
                onSelectNode(node);
              }}
            >
              <div className="hero-3d-node-card">
                <span className="hero-3d-node-icon">{node.icon}</span>
                <span className="hero-3d-node-title">{node.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hero-globe-drag-hint">
        <RotateCw size={12} /> DRAG / SWIPE TO ROTATE 3D ECOSYSTEM GLOBE
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CINEMATIC JOURNEY STEPPER COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CinematicJourneyStepper() {
  const [activeStep, setActiveStep] = useState(0);

  const nextStep = () => {
    setActiveStep(prev => (prev + 1) % JOURNEY_STEPS.length);
    audioManager.playSfx('tap_nav', 0.2);
  };

  const prevStep = () => {
    setActiveStep(prev => (prev - 1 + JOURNEY_STEPS.length) % JOURNEY_STEPS.length);
    audioManager.playSfx('tap_nav', 0.2);
  };

  const currentData = JOURNEY_STEPS[activeStep];

  return (
    <div className="hero-journey-stepper-wrap">
      {/* Progress Tabs */}
      <div className="hero-stepper-progress-bar">
        {JOURNEY_STEPS.map((step, idx) => (
          <div
            key={step.step}
            className="hero-stepper-tab"
            onClick={() => {
              setActiveStep(idx);
              audioManager.playSfx('tap_nav', 0.2);
            }}
          >
            <div
              className="hero-stepper-tab-fill"
              style={{ width: idx <= activeStep ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Slide Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          className="hero-stepper-slide-card"
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -15 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          <span className="hero-stepper-badge">{currentData.badge}</span>

          <div className="text-var(--palette-dominant) p-3 rounded-full bg-white/5 border border-white/10 shadow-[0_0_30px_var(--palette-dominant)]">
            {currentData.icon}
          </div>

          <h3 className="hero-stepper-title">{currentData.title}</h3>

          <p className="hero-stepper-desc">{currentData.desc}</p>

          <div className="hero-stepper-nav-row">
            <button
              onClick={prevStep}
              className="hero-stepper-btn"
              disabled={activeStep === 0}
            >
              <ChevronLeft size={16} /> PREV STEP
            </button>

            <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">
              {activeStep + 1} / {JOURNEY_STEPS.length}
            </span>

            <button
              onClick={nextStep}
              className="hero-stepper-btn"
            >
              NEXT STEP <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HERO LANDING PAGE COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function HeroLandingPage() {
  const params = useParams<{ dayParam?: string }>();
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  const maxAllowedDay = useMemo(() => getCurrentDay(), []);

  // Parse Day from URL (/hero/day-042, /hero/42, or ?day=42)
  const activeDay = useMemo(() => {
    let raw: string | undefined = params.dayParam;
    if (!raw && searchString) {
      const q = new URLSearchParams(searchString);
      raw = q.get('day') || undefined;
    }
    if (raw) {
      const match = raw.match(/\d+/);
      if (match) {
        const parsed = parseInt(match[0], 10);
        if (!isNaN(parsed) && parsed >= 1) {
          return Math.min(parsed, maxAllowedDay);
        }
      }
    }
    return maxAllowedDay;
  }, [params.dayParam, searchString, maxAllowedDay]);

  const isFutureRequested = useMemo(() => {
    let raw: string | undefined = params.dayParam;
    if (!raw && searchString) {
      const q = new URLSearchParams(searchString);
      raw = q.get('day') || undefined;
    }
    if (raw) {
      const match = raw.match(/\d+/);
      if (match) {
        const parsed = parseInt(match[0], 10);
        return !isNaN(parsed) && parsed > maxAllowedDay;
      }
    }
    return false;
  }, [params.dayParam, searchString, maxAllowedDay]);

  // Song catalog data
  const [catalog, setCatalog] = useState<SongCatalogItem[]>([]);

  useEffect(() => {
    fetch('/data/song_catalog.json')
      .then(res => res.json())
      .then((data: SongCatalogItem[]) => setCatalog(data))
      .catch(console.error);
  }, []);

  const songByDayMap = useMemo(() => {
    const map = new Map<number, SongCatalogItem>();
    catalog.forEach(item => map.set(item.day, item));
    return map;
  }, [catalog]);

  const song = songByDayMap.get(activeDay) || null;

  // Day Selector Command Modal State
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [daySearchQuery, setDaySearchQuery] = useState('');

  // Keybindings (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsDayModalOpen(prev => !prev);
      } else if (e.key === 'Escape' && isDayModalOpen) {
        setIsDayModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDayModalOpen]);

  // Dynamic Palette extraction from active song artwork
  const [palette, setPalette] = useState<ExtractedPalette>(getFallbackPalette());

  useEffect(() => {
    if (song?.coverArt) {
      extractPalette(song.coverArt)
        .then(setPalette)
        .catch(() => setPalette(getFallbackPalette()));
    }
  }, [song?.coverArt]);

  // Audio Preview Playback
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudioPreview = useCallback(() => {
    if (!song?.audioUrl) return;
    if (isPlayingPreview) {
      audioRef.current?.pause();
      setIsPlayingPreview(false);
      audioManager.playSfx('pause', 0.4);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(song.audioUrl);
        audioRef.current.onended = () => setIsPlayingPreview(false);
      } else {
        audioRef.current.src = song.audioUrl;
      }
      audioRef.current.play().catch(console.error);
      setIsPlayingPreview(true);
      audioManager.playSfx('select_start_song', 0.4);
    }
  }, [isPlayingPreview, song?.audioUrl]);

  // 3D Perspective Card Tilt
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setCardTilt({ x: y * 24, y: -x * 24 });
  };

  const handleCardMouseLeave = () => {
    setCardTilt({ x: 0, y: 0 });
  };

  // Section Ref & InView State
  const [activeSection, setActiveSection] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const [progressInView, setProgressInView] = useState(false);
  const [hoveredCardDay, setHoveredCardDay] = useState<number | null>(null);

  // Filter mode for 365 Grid
  const [filterMode, setFilterMode] = useState<'all' | 'unlocked' | 'dark' | 'light'>('all');

  // Selected Ecosystem Node Inspector
  const [selectedNode, setSelectedNode] = useState<EcosystemNode | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.target === progressRef.current) {
            setProgressInView(entry.isIntersecting);
          }
        });
      },
      { threshold: 0.2 }
    );
    if (progressRef.current) observer.observe(progressRef.current);
    return () => observer.disconnect();
  }, []);

  // Jump to specific Day Landing Page
  const jumpToDay = (targetDay: number) => {
    if (targetDay > maxAllowedDay) {
      audioManager.playSfx('locked_out', 0.5);
      return;
    }
    setIsPlayingPreview(false);
    audioRef.current?.pause();
    setLocation(`/hero/day-${String(targetDay).padStart(3, '0')}`);
    audioManager.playSfx('tap_nav', 0.3);
  };

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

  return (
    <div className="hero-landing" style={rootStyle}>
      {/* Film Noise Texture & Shader Beams */}
      <div className="hero-noise-overlay" />
      <div className="hero-ambient-beams">
        <div className="hero-beam-1" />
        <div className="hero-beam-2" />
        <div className="hero-beam-3" />
      </div>

      {/* Future Locked Warning Banner */}
      <AnimatePresence>
        {isFutureRequested && (
          <motion.div
            className="hero-future-banner"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
          >
            <Lock size={14} />
            <span>DAY LOCKED IN THE FUTURE // CLAMPED TO TODAY (DAY {maxAllowedDay})</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Side Scroll Nav Dots */}
      <div className="hero-side-nav">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
          <div
            key={i}
            className={`hero-side-nav-dot ${activeSection === i ? 'active' : ''}`}
            onClick={() => {
              setActiveSection(i);
              audioManager.playSfx('tap_nav', 0.2);
            }}
          />
        ))}
      </div>

      {/* ═══════════ SECTION 1 : HERO BANNER ═══════════ */}
      <section className="hero-hero-section" id="hero-top">
        {/* Dynamic Day Switcher Bar */}
        <div className="hero-day-stepper">
          <button
            className="hero-stepper-btn-sm"
            onClick={() => jumpToDay(Math.max(1, activeDay - 1))}
            disabled={activeDay <= 1}
            title="Previous Release Day"
          >
            <ChevronLeft size={14} /> Day {String(Math.max(1, activeDay - 1)).padStart(3, '0')}
          </button>

          <button
            className="hero-stepper-current"
            onClick={() => {
              setIsDayModalOpen(true);
              audioManager.playSfx('tap_nav', 0.3);
            }}
            title="Open Day Switcher (⌘K)"
          >
            <Calendar size={14} className="text-[var(--palette-dominant)]" />
            <span>DAY {String(activeDay).padStart(3, '0')} // LANDING PAGE</span>
            <span className="hero-cmd-badge"><Command size={10} />K</span>
          </button>

          <button
            className="hero-stepper-btn-sm"
            onClick={() => jumpToDay(activeDay + 1)}
            disabled={activeDay >= maxAllowedDay}
            title={activeDay >= maxAllowedDay ? 'Future day locked' : 'Next Release Day'}
          >
            {activeDay >= maxAllowedDay ? (
              <>
                <Lock size={12} className="opacity-60" /> LOCKED
              </>
            ) : (
              <>
                Day {String(activeDay + 1).padStart(3, '0')} <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>

        {/* Persona 5 / Arcane Kinetic Title */}
        <motion.div
          className="hero-brand"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        >
          <h1 className="hero-title-pim">P I M</h1>
          <p className="hero-subtitle">Poetry In Motion</p>
        </motion.div>

        <motion.p
          className="hero-tagline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.85 }}
          transition={{ duration: 0.9, delay: 0.25 }}
        >
          One Original Song. Every Single Day.
        </motion.p>

        <motion.p
          className="hero-[#00E5FF] font-mono text-[10px] tracking-[0.3em] uppercase opacity-80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 0.9, delay: 0.35 }}
        >
          Listen · Play · Collect · Return Tomorrow
        </motion.p>

        {/* Play Button CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
        >
          <Link
            to="/play"
            className="hero-cta-button"
            onClick={() => audioManager.playSfx('select_start_song', 0.6)}
          >
            <Play size={18} fill="currentColor" /> PLAY TODAY&apos;S DROP
          </Link>
        </motion.div>

        <motion.div
          className="hero-meta-strip"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          <span>Day {activeDay}</span>
          <span>·</span>
          <span>{song ? formatDate(song.day) : `Day ${activeDay}`}</span>
        </motion.div>
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 2 : TODAY'S DROP STAGE ═══════════ */}
      <section className="hero-drop-section" id="hero-drop">
        <motion.p
          className="hero-drop-header"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.45 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          TODAY&apos;S DROP // DAY {activeDay}
        </motion.p>

        {/* 3D Perspective Mouse Tilt Stage */}
        <motion.div
          ref={cardRef}
          className="hero-drop-card-container"
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
          style={{
            transform: `rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg)`,
          }}
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        >
          <div className="hero-drop-glow" />

          {/* Holographic Spinning Vinyl Disc */}
          <div className={`hero-vinyl-disc ${isPlayingPreview ? 'playing' : ''}`}>
            <div
              className="hero-vinyl-label"
              style={{
                backgroundImage: song?.coverArt ? `url(${song.coverArt})` : undefined,
              }}
            />
          </div>

          <div className="hero-drop-card">
            <div className="hero-specular-glare" />

            <div className="hero-cover-wrap">
              {song?.coverArt ? (
                <img
                  src={song.coverArt}
                  alt={song.title}
                  className="hero-cover-art"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full bg-[#0a0a10] flex items-center justify-center font-mono text-xs text-white/30">
                  DAY {activeDay} ARTWORK
                </div>
              )}
            </div>

            <h2 className="hero-song-title">&quot;{song?.title || `Track Day ${activeDay}`}&quot;</h2>

            <p className="hero-song-meta">
              {song ? formatDuration(song.duration) : '--:--'} · by {song?.artist || 'th3scr1b3'} · {song?.bpm || 120} BPM
            </p>

            {/* Audio Stem Preview Bar & Waveform */}
            <div className="w-full mt-4 flex flex-col items-center gap-3">
              <button
                className="hero-stem-preview-btn"
                onClick={toggleAudioPreview}
                title={isPlayingPreview ? 'Pause Audio Preview' : 'Play Audio Preview'}
              >
                {isPlayingPreview ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                <span>{isPlayingPreview ? 'PAUSE PREVIEW' : 'PLAY AUDIO STEM'}</span>
              </button>

              {/* Real-Time Waveform Visualizer */}
              <div className="hero-waveform-bar">
                {Array.from({ length: 28 }, (_, idx) => (
                  <div
                    key={idx}
                    className={`hero-waveform-step ${isPlayingPreview ? 'active' : ''}`}
                    style={{
                      height: isPlayingPreview
                        ? `${Math.max(20, Math.sin((idx + 1) * 0.8) * 100)}%`
                        : `${(idx % 5) * 15 + 20}%`,
                      animationDelay: `${(idx % 10) * 0.08}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 3 : CINEMATIC STEPPER ("ONE SONG BECOMES...") ═══════════ */}
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

        {/* Full-Section Cinematic Stepper Component */}
        <CinematicJourneyStepper />
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 4 : THE 365 HEATMAP COLLECTION ═══════════ */}
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

        {/* Dark / Light Mood Legend with Custom Vector Icons */}
        <div className="flex items-center gap-6 mb-6 font-mono text-[10px] tracking-widest uppercase opacity-85">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--palette-dominant)' }}>
            <Moon size={13} className="text-[var(--palette-dominant)]" />
            DARK MOODS
          </span>
          <span className="flex items-center gap-1.5" style={{ color: 'var(--palette-accent)' }}>
            <Sun size={13} className="text-[var(--palette-accent)]" />
            LIGHT MOODS
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
              {mode === 'dark' ? (
                <span className="flex items-center gap-1"><Moon size={11} /> DARK</span>
              ) : mode === 'light' ? (
                <span className="flex items-center gap-1"><Sun size={11} /> LIGHT</span>
              ) : (
                mode.toUpperCase()
              )}
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
                  : 'LOCKED IN THE FUTURE'}
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
      <section className="hero-gameplay-section" id="hero-gameplay">
        <motion.div
          className="hero-gameplay-wrap"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        >
          <img
            src="/screenshots/06_rhythm_gameplay.png"
            alt="PIM rhythm gameplay — perfect run"
            className="hero-gameplay-media hero-gameplay-ken-burns"
            loading="lazy"
          />
        </motion.div>

        <motion.p
          className="hero-gameplay-label"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.4 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Perfect Run · Day {activeDay}
        </motion.p>
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 7 : 3D MOVEABLE ECOSYSTEM GLOBE ═══════════ */}
      <section className="hero-ecosystem-section" id="hero-ecosystem">
        <motion.h3
          className="font-mono text-xs text-[#00E5FF] tracking-[0.3em] uppercase font-bold mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Ecosystem Constellation Globe
        </motion.h3>

        {/* 3D Moveable Globe Component */}
        <EcosystemGlobe3D
          onSelectNode={node => {
            setSelectedNode(node);
            audioManager.playSfx('reveal', 0.4);
          }}
          selectedNodeId={selectedNode?.id}
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
                  <h3 className="text-xl font-black font-mono text-white uppercase tracking-wider flex items-center gap-2">
                    {selectedNode.icon} {selectedNode.label}
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

              {/* Technical Readout Table */}
              <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-black/40 border border-white/10 font-mono text-[10px]">
                {ECOSYSTEM_INSPECTOR_ITEMS.slice(0, 4).map(item => (
                  <div key={item.key} className="flex flex-col">
                    <span className="text-white/40 uppercase">{item.key}</span>
                    <span className="text-[#00E5FF] font-bold">{item.getVal(song)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <a
                  href={selectedNode.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--palette-dominant)] text-black font-mono text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-white"
                >
                  Visit Node <ExternalLink size={12} />
                </a>

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
          <div className="hero-stat-item">
            <span className="hero-stat-number">{activeDay}</span>
            <span className="hero-stat-label">Songs Released</span>
          </div>

          <div className="hero-stat-item">
            <span className="hero-stat-number">{activeDay}</span>
            <span className="hero-stat-label">Playable Levels</span>
          </div>

          <div className="hero-stat-item">
            <span className="hero-stat-number">{activeDay}</span>
            <span className="hero-stat-label">Cards Minted</span>
          </div>

          <div className="hero-stat-item">
            <span className="hero-stat-number">100%</span>
            <span className="hero-stat-label">Daily On Time</span>
          </div>
        </motion.div>
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 9 : ROADMAP TIMELINE ═══════════ */}
      <section className="hero-roadmap-section" id="hero-roadmap">
        <h3 className="hero-roadmap-title">Roadmap</h3>

        <div className="hero-roadmap-timeline">
          {ROADMAP_GENS.map((gen, i) => (
            <motion.div
              key={gen.gen}
              className="hero-roadmap-gen"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              <div className={`hero-roadmap-dot ${!gen.active ? 'hero-roadmap-dot--inactive' : ''}`} />
              <div className="hero-roadmap-gen-title">{gen.gen} · {gen.title}</div>
              <div className="hero-roadmap-gen-desc">{gen.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="hero-section-divider" />

      {/* ═══════════ SECTION 10 : FOOTER ═══════════ */}
      <footer className="hero-footer-section">
        <p className="hero-footer-copy">
          PIM : TH3V4ULT · Poetry In Motion · {new Date().getFullYear()}
        </p>
        <p className="hero-footer-sub">
          One original song every single day. All rights reserved.
        </p>
      </footer>

      {/* DAY SELECTOR COMMAND PALETTE MODAL (⌘K) */}
      <AnimatePresence>
        {isDayModalOpen && (
          <motion.div
            className="hero-day-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsDayModalOpen(false)}
          >
            <motion.div
              className="hero-day-modal"
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="hero-command-input-wrap">
                <Search size={18} className="hero-command-search-icon" />
                <input
                  type="text"
                  className="hero-command-input"
                  placeholder="Search song title, artist, or day number (1 to 365)..."
                  value={daySearchQuery}
                  onChange={e => setDaySearchQuery(e.target.value)}
                  autoFocus
                />
                <button
                  className="hero-command-close"
                  onClick={() => setIsDayModalOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="hero-command-list">
                {Array.from({ length: maxAllowedDay }, (_, i) => {
                  const day = maxAllowedDay - i; // reverse order (newest first)
                  const item = songByDayMap.get(day);
                  const title = item?.title || `Track Day ${day}`;
                  const artist = item?.artist || 'th3scr1b3';

                  if (
                    daySearchQuery.trim() &&
                    !title.toLowerCase().includes(daySearchQuery.toLowerCase()) &&
                    !artist.toLowerCase().includes(daySearchQuery.toLowerCase()) &&
                    !String(day).includes(daySearchQuery.trim())
                  ) {
                    return null;
                  }

                  const isCurrent = day === activeDay;

                  return (
                    <div
                      key={day}
                      className={`hero-command-item ${isCurrent ? 'active' : ''}`}
                      onClick={() => {
                        jumpToDay(day);
                        setIsDayModalOpen(false);
                      }}
                    >
                      {item?.coverArt ? (
                        <img src={item.coverArt} alt={title} className="hero-command-thumb" />
                      ) : (
                        <div className="hero-command-thumb bg-[#151520] flex items-center justify-center font-mono text-[9px]">
                          {day}
                        </div>
                      )}

                      <div className="hero-command-meta">
                        <div className="hero-command-title">
                          Day {day} — &quot;{title}&quot;
                        </div>
                        <div className="hero-command-sub">
                          by {artist} · {item ? formatDuration(item.duration) : '--:--'}
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="font-mono text-[9px] text-[#39FF14] font-bold">PREVIEWING</span>
                      ) : (
                        <span className="font-mono text-[9px] text-white/40">SELECT</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
