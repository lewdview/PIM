import { useLocation } from "wouter";
import { useState, useEffect, useMemo, useRef } from "react";
import { loadCatalog, isSongTimeLocked, getModifierForSong } from "@/game/api";
import type { GameSong } from "@/game/api";
import { audioManager } from "@/game/audio";
import { getActiveTheme } from "@/lib/options";
import { useVaultStore } from "../store/useVaultStore";
import { getCurrentDay, getMonthNumFromDay, getRelativeDay } from "../utils/dayCalc";
import { CHAPTERS, type ChapterMeta } from "@/game/campaign";
import { getMedalForSong, getHighScore, getScoreHistory } from "@/game/progress";
import PrizeProgressMenu from "../components/PrizeProgressMenu";
import { Lock, Unlock, Play, Sliders, Music, Volume2, VolumeX, Activity, Award, Trophy, ChevronLeft, ChevronRight, Film } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LANE_COLORS = ['#FF1493', '#39FF14', '#E5B800', '#8B48E5'];
const MEDAL_COLOR: Record<string, string> = {
  PLATINUM: '#39FF14', GOLD: '#E5B800', SILVER: '#A0AABB', BRONZE: '#C97A3A', NONE: '#444', '': '#1a1a1a',
};
const DIFF_COLORS = [
  '#39FF14','#39FF14','#39FF14',
  '#00E5FF','#00E5FF','#00E5FF',
  '#E5B800','#E5B800','#E5B800',
  '#FF1493',
];

/** Mini audio waveform animation */
function WaveformBars({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-end gap-px" style={{ height: 16 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-sm"
          style={{
            width: 3,
            height: playing ? `${40 + Math.sin(Date.now() / 180 + i * 1.5) * 35}%` : '30%',
            background: playing ? '#39FF14' : 'rgba(255,255,255,0.2)',
            transition: 'height 0.15s ease, background 0.3s',
            animation: playing ? `waveBar 0.6s ${i * 0.1}s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  );
}

interface MonthGroupData {
  meta: ChapterMeta;
  songs: GameSong[];
  clearedCount: number;
}

export default function SongSelect() {
  const [, setLocation] = useLocation();
  const [songs, setSongs] = useState<GameSong[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Left Column: Selected Month (1-12)
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  // Stage Index within the active month (0 to songs.length - 1)
  const [stageIndex, setStageIndex] = useState<number>(0);

  const [search, setSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState<'all' | 'light' | 'dark'>('all');
  const [sortBy, setSortBy] = useState<'day' | 'bpm'>('day');

  // Calibration state
  const [diffOverride, setDiffOverride] = useState<number>(5);
  const [history, setHistory] = useState<number[]>([]);

  // Audio preview state
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewProg, setPreviewProg] = useState(0);

  // Parallax scrolling
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const isAvant = getActiveTheme() === 'avant-garde';

  const collection = useVaultStore((s) => s.collection);
  const fragments = useVaultStore((s) => s.fragments);
  const loadVaultData = useVaultStore((s) => s.loadVaultData);
  const claimedRewards = useVaultStore((s) => s.claimedRewards);
  const equippedCardId = useVaultStore((s) => s.equippedCardId);

  useEffect(() => {
    if (collection.length === 0) {
      loadVaultData().catch(err => console.warn("Failed to load vault data inside SongSelect", err));
    }
  }, [collection.length, loadVaultData]);

  useEffect(() => {
    audioManager.loadSfx("back");
    audioManager.loadSfx("tap_nav");
    loadCatalog().then((catalog) => {
      const released = catalog.filter(s => !isSongTimeLocked(s)).sort((a, b) => a.day - b.day);
      setSongs(released);
      if (released.length > 0) {
        const latest = released[released.length - 1];
        const latestMonth = getMonthNumFromDay(latest.day);
        setSelectedMonth(latestMonth);
        
        // Find stage index in latest month
        const monthSongs = released.filter(s => getMonthNumFromDay(s.day) === latestMonth);
        const idxInMonth = monthSongs.findIndex(s => s.id === latest.id);
        setStageIndex(idxInMonth >= 0 ? idxInMonth : 0);

        setDiffOverride(latest.difficultyLevel);
        setHistory(getScoreHistory(latest.id));
      }
      setLoading(false);
    });
  }, []);

  // Group songs into month chapters
  const monthGroups = useMemo(() => {
    return CHAPTERS.map((meta) => {
      const monthSongs = songs.filter(s => {
        if (s.day !== undefined) return getMonthNumFromDay(s.day) === meta.month;
        if (!s.date) return false;
        const parts = s.date.split('-');
        return parts.length > 1 && parseInt(parts[1], 10) === meta.month;
      }).sort((a, b) => a.day - b.day);

      const clearedCount = monthSongs.filter(s => getHighScore(s.id) > 0).length;

      return {
        meta,
        songs: monthSongs,
        clearedCount,
      } as MonthGroupData;
    });
  }, [songs]);

  // Active Month Group Data
  const activeMonthGroup = useMemo(() => {
    return monthGroups.find(g => g.meta.month === selectedMonth) || monthGroups[0];
  }, [monthGroups, selectedMonth]);

  // Filtered Stages for the selected month
  const activeMonthStages = useMemo(() => {
    if (!activeMonthGroup) return [];
    let list = activeMonthGroup.songs;
    if (moodFilter !== 'all') list = list.filter((s) => s.mood === moodFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.title.toLowerCase().includes(q) || String(s.day).includes(q) || s.artist.toLowerCase().includes(q));
    }
    if (sortBy === 'bpm') list = [...list].sort((a, b) => b.bpm - a.bpm);
    return list;
  }, [activeMonthGroup, moodFilter, search, sortBy]);

  // Active Selected Song (Stage)
  const selected = useMemo(() => {
    if (activeMonthStages.length === 0) return null;
    const clampedIndex = Math.max(0, Math.min(stageIndex, activeMonthStages.length - 1));
    return activeMonthStages[clampedIndex] || null;
  }, [activeMonthStages, stageIndex]);

  // Update calibration & score history when selected song changes
  useEffect(() => {
    if (selected) {
      const savedOverride = sessionStorage.getItem(`diff_override_${selected.id}`);
      if (savedOverride) {
        setDiffOverride(parseInt(savedOverride, 10));
      } else {
        setDiffOverride(selected.difficultyLevel);
      }
      setHistory(getScoreHistory(selected.id));
      cleanupPreview();
    }
  }, [selected?.id]);

  // Audio preview handlers
  const onTimeUpdate = () => {
    const audio = previewRef.current;
    if (audio && audio.duration) {
      setPreviewProg(audio.currentTime / audio.duration);
    }
  };

  const onEnded = () => {
    setPreviewing(false);
    setPreviewProg(0);
  };

  const cleanupPreview = () => {
    const audio = previewRef.current;
    if (audio) {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.src = '';
      try { audio.load(); } catch {}
    }
    setPreviewing(false);
    setPreviewProg(0);
  };

  useEffect(() => {
    return () => {
      cleanupPreview();
      previewRef.current = null;
    };
  }, []);

  const togglePreview = (songToPlay?: GameSong) => {
    const targetSong = songToPlay || selected;
    if (!targetSong) return;
    audioManager.playSfx('tap_nav', 0.12);

    if (previewing && previewRef.current) {
      previewRef.current.pause();
      setPreviewing(false);
      return;
    }

    cleanupPreview();

    const audio = new Audio(targetSong.audioUrl);
    audio.volume = 0.5;
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    previewRef.current = audio;
    if (previewRef.current.currentTime < 1) {
      previewRef.current.currentTime = targetSong.duration * 0.15;
    }
    previewRef.current.play().catch(() => {});
    setPreviewing(true);
  };

  const today = getCurrentDay();
  const getFragmentsForDay = (day: number) => {
    const cardKey = `card-${day}`;
    const dayKey = `day-${String(day).padStart(3, '0')}`;
    const dayKeyRaw = `day-${day}`;
    return fragments[cardKey] ?? fragments[dayKey] ?? fragments[dayKeyRaw] ?? 0;
  };

  const isSongUnlocked = (song: GameSong) => {
    if (song.day === today) return true;
    const ownsCard = Array.isArray(collection) ? collection.some(c => c && (c.cardId === song.id || c.card?.day === song.day)) : false;
    const fragmentCount = getFragmentsForDay(song.day);
    return ownsCard || fragmentCount >= 10;
  };

  const selectedUnlocked = selected ? isSongUnlocked(selected) : false;
  const isAllPrizesClaimed = selected
    ? (claimedRewards[selected.id]?.includes('prophecy') || localStorage.getItem(`reward_tier_${selected.id}`) === 'prophecy')
    : false;

  const parallaxBgRef = useRef<HTMLDivElement>(null);

  // Track scroll position for main view parallax animation (direct DOM mutation)
  useEffect(() => {
    let rafId = 0;
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      const st = target.scrollTop;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (parallaxBgRef.current) {
          parallaxBgRef.current.style.transform = `translateY(${st * -0.05}px) scale(1.05)`;
        }
      });
    };

    const el = mainScrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (el) el.removeEventListener('scroll', handleScroll);
    };
  }, [loading]);

  // Handle Month Change
  const handleSelectMonth = (monthNum: number) => {
    audioManager.playSfx('tap_nav', 0.1);
    setSelectedMonth(monthNum);
    setStageIndex(0); // Reset to Stage 1 of the new month
  };

  // Stage Navigation: Next / Prev
  const handlePrevStage = () => {
    if (stageIndex > 0) {
      audioManager.playSfx('tap_nav', 0.08);
      setStageIndex(stageIndex - 1);
    }
  };

  const handleNextStage = () => {
    if (stageIndex < activeMonthStages.length - 1) {
      audioManager.playSfx('tap_nav', 0.08);
      setStageIndex(stageIndex + 1);
    }
  };

  // Keyboard Navigation: Left & Right Arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevStage();
      } else if (e.key === 'ArrowRight') {
        handleNextStage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stageIndex, activeMonthStages.length]);

  const handlePlaySong = (songToPlay?: GameSong) => {
    const s = songToPlay || selected;
    if (!s || !isSongUnlocked(s)) return;
    cleanupPreview();
    audioManager.playSfx('tap_nav', 0.4);
    sessionStorage.setItem(`game_origin_${s.id}`, 'songs');
    sessionStorage.setItem(`diff_override_${s.id}`, String(diffOverride));
    
    const modifierType = getModifierForSong(s);
    const isEquipped = equippedCardId === s.id;
    if (isEquipped && modifierType !== 'none') {
      sessionStorage.setItem(`active_modifier_type_${s.id}`, modifierType);
    } else {
      sessionStorage.removeItem(`active_modifier_type_${s.id}`);
    }

    setLocation(`/play/${s.id}`);
  };

  const activeCoverUrl = selected?.coverArt || '/data/covers/default.jpg';
  const activeMoodColor = selected ? (selected.mood === 'light' ? '#39FF14' : '#FF1493') : '#39FF14';
  const medal = selected ? getMedalForSong(selected.id) : '';
  const medalColor = MEDAL_COLOR[medal] || '#444';
  const diffColor = DIFF_COLORS[Math.min(diffOverride - 1, 9)];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="font-mono text-xs tracking-[0.3em] text-[#39FF14] animate-pulse uppercase">
          SYNCHRONIZING AWARD PLAY ARCHIVES...
        </div>
      </div>
    );
  }

  const parallaxTitleY = (scrollTop * 0.12) % 80;
  const currentStageNumber = selected ? getRelativeDay(selected.day) : stageIndex + 1;

  return (
    <div className="min-h-dvh w-full flex flex-col relative overflow-hidden select-none bg-[#050402] text-white">
      {/* Dynamic High-Res Album Artwork Background Engine with Parallax */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#050402]">
        {/* High-Res Album Artwork Layer */}
        <div
          ref={parallaxBgRef}
          className="absolute inset-0 transition-all duration-700 ease-out scale-[1.05]"
          style={{
            backgroundImage: `url(${activeCoverUrl})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        />
        {/* Dark Vignette & Gradient Overlay for Crisp Text Contrast */}
        <div
          className="absolute inset-0 transition-all duration-700"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, rgba(5,4,2,0.68) 0%, rgba(5,4,2,0.92) 85%), linear-gradient(to bottom, rgba(5,4,2,0.7) 0%, rgba(5,4,2,0.9) 100%)`,
          }}
        />
        {/* Dynamic Mood Color Lighting */}
        <div
          className="absolute inset-0 opacity-35 mix-blend-screen transition-all duration-1000 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 60% 40%, ${activeMoodColor}40 0%, transparent 75%)`,
          }}
        />
        {/* Cyber Grid Overlay */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Header Bar */}
      <header
        className="relative z-20 flex items-center justify-between px-5 py-3.5 flex-shrink-0"
        style={{
          background: isAvant ? 'rgba(5,5,5,0.92)' : 'rgba(8,8,12,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: isAvant ? '1px solid rgba(57,255,20,0.2)' : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            data-testid="button-back"
            onClick={() => {
              audioManager.playSfx("back", 0.5);
              setLocation("/arcade");
            }}
            onMouseEnter={() => audioManager.playSfx("tap_nav", 0.08)}
            className={isAvant
              ? "font-mono text-xs px-4 py-1.5 tracking-widest border border-[#39FF14]/30 text-[#39FF14] bg-transparent hover:bg-[#39FF14]/10 transition-colors cursor-pointer"
              : "neon-btn-outline text-xs px-4 py-1.5 tracking-widest cursor-pointer"}
          >
            ← ARCADE
          </button>
          <button
            onClick={() => {
              audioManager.playSfx("tap_nav", 0.12);
              setLocation("/campaign");
            }}
            onMouseEnter={() => audioManager.playSfx("tap_nav", 0.08)}
            className="hidden sm:block font-mono text-xs px-3 py-1.5 tracking-widest border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            SECTOR MAP →
          </button>
        </div>

        <div className="font-mono text-xs tracking-[0.3em] font-bold text-center" style={{ color: isAvant ? '#39FF14' : 'rgba(255,255,255,0.8)' }}>
          AWARD PLAY ARCHIVE // {songs.length} SIGNALS
        </div>

        <div className="font-mono text-xs text-white/40 tracking-widest hidden sm:block uppercase">
          PIM // STAGE SHOWCASE
        </div>
      </header>

      {/* Main Split Layout: Left (Month Selection 01-12) & Right (Full-Space Active Stage Showcase) */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT COLUMN: Month Selection List (Month 01 - 12) */}
        <div className="w-full md:w-64 lg:w-72 flex-shrink-0 border-r border-white/10 flex flex-col bg-black/70 backdrop-blur-md overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="font-mono text-[10px] font-bold tracking-[0.25em] text-[#39FF14] uppercase">
              // MONTH SELECTION
            </div>
            <div className="font-mono text-[9px] text-white/40">
              12 SECTORS
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {monthGroups.map((group) => {
              const isActive = selectedMonth === group.meta.month;
              return (
                <button
                  key={group.meta.month}
                  onClick={() => handleSelectMonth(group.meta.month)}
                  onMouseEnter={() => audioManager.playSfx('tap_nav', 0.04)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer relative group overflow-hidden ${
                    isActive
                      ? 'bg-white/10 border-l-4 shadow-lg'
                      : 'bg-black/40 hover:bg-white/5 border-white/5 hover:border-white/20'
                  }`}
                  style={{
                    borderLeftColor: isActive ? group.meta.dc : 'transparent',
                    boxShadow: isActive ? `0 0 16px ${group.meta.dc}30` : 'none',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-[9px] font-black px-1.5 py-[1px] rounded uppercase"
                        style={{
                          color: isActive ? '#000' : group.meta.dc,
                          background: isActive ? group.meta.dc : `${group.meta.dc}15`,
                          border: `1px solid ${group.meta.dc}40`,
                        }}
                      >
                        M{String(group.meta.month).padStart(2, '0')}
                      </span>
                      <span className="font-mono text-[9px] font-bold text-white/40 uppercase">
                        {group.meta.diff}
                      </span>
                    </div>

                    <span className="font-mono text-[9px] text-white/50">
                      <strong className="text-[#39FF14]">{group.clearedCount}</strong>/{group.songs.length} STAGES
                    </span>
                  </div>

                  <div className="font-mono font-black text-sm uppercase tracking-tight text-white flex items-center justify-between">
                    <span>{group.meta.name}</span>
                    <ChevronRight size={14} className={`transition-transform ${isActive ? 'translate-x-1 text-[#39FF14]' : 'opacity-30'}`} />
                  </div>

                  <div className="font-mono text-[9px] text-white/40 uppercase mt-0.5 truncate">
                    {group.meta.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* MAIN VIEW: FULL-SPACE STAGE SHOWCASE WITH ALBUM ARTWORK BACKGROUND */}
        <div
          ref={mainScrollRef}
          className="flex-1 overflow-y-auto bg-black/30 backdrop-blur-xl flex flex-col p-4 lg:p-8 relative"
        >
          {/* Parallax Background Month & Stage Text */}
          {activeMonthGroup && (
            <div
              className="absolute right-4 top-10 font-mono font-black select-none pointer-events-none text-[16vw] lg:text-[12vw] tracking-tighter leading-none opacity-10 transition-transform duration-300"
              style={{
                color: activeMonthGroup.meta.dc,
                WebkitTextStroke: `1.5px ${activeMonthGroup.meta.dc}40`,
                transform: `translateY(${parallaxTitleY}px)`,
              }}
            >
              M{String(activeMonthGroup.meta.month).padStart(2, '0')} // STAGE {currentStageNumber}
            </div>
          )}

          {/* TOP CONTROLS & STAGE STEPPER BAR */}
          <div className="relative z-20 space-y-4 max-w-4xl mx-auto w-full mb-6">
            {/* Sector Header & Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-black/70 border border-white/10 p-4 rounded-2xl backdrop-blur-xl">
              <div>
                <div className="font-mono text-[9px] font-bold tracking-[0.25em] text-[#39FF14] uppercase">
                  SECTOR {String(activeMonthGroup?.meta.month).padStart(2, '0')} // STAGE SHOWCASE
                </div>
                <h2 className="font-mono font-black text-xl uppercase tracking-tight text-white flex items-center gap-2">
                  <span>{activeMonthGroup?.meta.name}</span>
                  <span className="text-xs text-white/40 font-mono font-normal">({activeMonthStages.length} STAGES)</span>
                </h2>
              </div>

              {/* Stage Counter & Prev/Next Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevStage}
                  disabled={stageIndex <= 0}
                  className={`px-4 py-2 rounded-xl font-mono text-xs font-bold tracking-wider flex items-center gap-1.5 transition-all uppercase cursor-pointer ${
                    stageIndex > 0
                      ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-[#39FF14]'
                      : 'border border-white/5 bg-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  <ChevronLeft size={16} />
                  <span>← STAGE {stageIndex > 0 ? getRelativeDay(activeMonthStages[stageIndex - 1]?.day || 1) : 1}</span>
                </button>

                <div className="font-mono text-center px-4 py-2 bg-black/90 border border-[#39FF14]/40 rounded-xl shadow-lg">
                  <div className="text-[8px] text-white/40 uppercase font-bold tracking-widest">ACTIVE STAGE</div>
                  <div className="text-base font-black text-[#39FF14]">
                    {currentStageNumber} <span className="text-xs text-white/40">/ {activeMonthStages.length}</span>
                  </div>
                </div>

                <button
                  onClick={handleNextStage}
                  disabled={stageIndex >= activeMonthStages.length - 1}
                  className={`px-4 py-2 rounded-xl font-mono text-xs font-bold tracking-wider flex items-center gap-1.5 transition-all uppercase cursor-pointer ${
                    stageIndex < activeMonthStages.length - 1
                      ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-[#39FF14]'
                      : 'border border-white/5 bg-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  <span>STAGE {stageIndex < activeMonthStages.length - 1 ? getRelativeDay(activeMonthStages[stageIndex + 1]?.day || 1) : activeMonthStages.length} →</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Quick Stage Jump Pill Strip (1..31) */}
            <div className="flex items-center gap-1.5 overflow-x-auto p-2 bg-black/60 border border-white/10 rounded-xl scrollbar-none backdrop-blur-xl" style={{ scrollbarWidth: 'none' }}>
              <span className="font-mono text-[8px] text-white/40 tracking-widest px-2 uppercase font-bold flex-shrink-0">JUMP TO STAGE:</span>
              {activeMonthStages.map((s, idx) => {
                const sNum = getRelativeDay(s.day);
                const isSelected = idx === stageIndex;
                const unlocked = isSongUnlocked(s);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      audioManager.playSfx('tap_nav', 0.08);
                      setStageIndex(idx);
                    }}
                    className={`font-mono text-[9px] font-black w-8 h-7 flex items-center justify-center rounded transition-all flex-shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#39FF14] text-black shadow-[0_0_10px_rgba(57,255,20,0.5)] scale-105'
                        : unlocked
                        ? 'bg-white/5 text-white/70 hover:bg-white/20 hover:text-white border border-white/10'
                        : 'bg-black/60 text-[#FF3800]/50 border border-[#FF3800]/20'
                    }`}
                  >
                    {sNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STAGE FULL SPACE CONTENT CARD */}
          <div className="relative z-10 max-w-4xl mx-auto w-full flex-1 space-y-6 bg-black/75 border border-white/15 p-6 lg:p-10 rounded-3xl backdrop-blur-2xl shadow-2xl">
            {selected ? (
              <div className="space-y-6">
                {/* Header Title Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-4 gap-3">
                  <div>
                    <div className="font-mono text-[9px] tracking-[0.25em] text-[#39FF14] uppercase mb-1 flex items-center gap-2">
                      <Activity size={12} className="animate-pulse" />
                      <span>STAGE {currentStageNumber} // FULL CALIBRATION SHOWCASE</span>
                    </div>
                    <div className="font-mono text-xs text-white/30 uppercase">
                      SIGNAL REF: {selected.id.toUpperCase().substring(0, 16)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-[9px] font-bold px-3 py-1 border uppercase rounded"
                      style={{ color: activeMoodColor, borderColor: `${activeMoodColor}40`, background: `${activeMoodColor}10` }}
                    >
                      MOOD: {selected.mood.toUpperCase()}
                    </span>
                    <span className="font-mono text-[9px] font-bold px-3 py-1 border border-white/20 uppercase rounded text-white/50 bg-white/5">
                      LVL {selected.difficultyLevel}
                    </span>
                  </div>
                </div>

                {/* Hero Stage Artwork & Details */}
                <div className="flex flex-col md:flex-row gap-8 items-center bg-white/[0.03] border border-white/10 p-6 rounded-2xl backdrop-blur-md">
                  {/* Stage Cover Art */}
                  <div className="relative flex-shrink-0 group">
                    <div className="absolute -top-2.5 -left-2.5 w-5 h-5 border-t-2 border-l-2 border-[#39FF14]" />
                    <div className="absolute -top-2.5 -right-2.5 w-5 h-5 border-t-2 border-r-2 border-[#39FF14]" />
                    <div className="absolute -bottom-2.5 -left-2.5 w-5 h-5 border-b-2 border-l-2 border-[#39FF14]" />
                    <div className="absolute -bottom-2.5 -right-2.5 w-5 h-5 border-b-2 border-r-2 border-[#39FF14]" />

                    {selected.coverArt ? (
                      <img
                        src={selected.coverArt}
                        alt={selected.title}
                        className="w-48 h-48 md:w-56 md:h-56 object-cover rounded-2xl shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                        style={{
                          border: '1px solid rgba(57,255,20,0.3)',
                          filter: selectedUnlocked ? 'none' : 'grayscale(100%) brightness(0.4)',
                        }}
                      />
                    ) : (
                      <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl flex items-center justify-center font-mono font-black text-4xl bg-white/5 border border-white/10 text-white/30">
                        STAGE {currentStageNumber}
                      </div>
                    )}

                    {/* Audio Preview Overlay Button */}
                    {selectedUnlocked && (
                      <button
                        onClick={() => togglePreview(selected)}
                        className="absolute inset-0 rounded-2xl flex items-center justify-center transition-all bg-black/40 hover:bg-black/60 text-white cursor-pointer"
                      >
                        <div className="w-14 h-14 rounded-full border border-white/30 bg-black/70 flex items-center justify-center shadow-xl">
                          {previewing ? <VolumeX size={24} className="text-[#39FF14]" /> : <Volume2 size={24} className="text-white" />}
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Stage Meta info */}
                  <div className="flex-1 min-w-0 text-center md:text-left space-y-2">
                    <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap">
                      <span className="font-mono text-[10px] px-2.5 py-0.5 border font-bold uppercase rounded text-white/50 border-white/20 bg-white/5">
                        STAGE #{currentStageNumber} (DAY {selected.day})
                      </span>
                      {medal && medal !== '' && (
                        <span
                          className="font-mono text-[10px] px-2.5 py-0.5 border font-bold uppercase rounded"
                          style={{ color: medalColor, borderColor: `${medalColor}40`, background: `${medalColor}10` }}
                        >
                          {medal}
                        </span>
                      )}
                      {isAllPrizesClaimed && (
                        <span className="font-mono text-[10px] px-2.5 py-0.5 border border-yellow-400 text-yellow-400 bg-yellow-400/10 font-bold uppercase flex items-center gap-1 rounded">
                          <Trophy size={12} /> ALL PRIZES CLAIMED
                        </span>
                      )}
                    </div>

                    <h1 className="font-mono font-black text-3xl md:text-4xl uppercase leading-tight tracking-tight text-white">
                      {selected.title}
                    </h1>
                    <div className="font-mono text-base text-white/70 font-bold uppercase">
                      {selected.artist}
                    </div>
                    <div className="font-mono text-xs text-white/40 uppercase">
                      RELEASE DATE: {selected.date} {selected.key ? `// KEY: ${selected.key}` : ''}
                    </div>

                    {selected.description && (
                      <p className="font-mono text-xs italic text-white/50 leading-relaxed border-l-2 border-[#39FF14]/40 pl-3 py-1 mt-2 text-left">
                        "{selected.description.toUpperCase()}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Audio Preview Waveform Bar */}
                {previewing && selectedUnlocked && (
                  <div className="border border-[#39FF14]/30 bg-black/80 p-4 rounded-xl flex items-center gap-4">
                    <WaveformBars playing={previewing} />
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-150"
                        style={{ width: `${previewProg * 100}%`, background: activeMoodColor, boxShadow: `0 0 10px ${activeMoodColor}` }}
                      />
                    </div>
                    <button
                      onClick={() => togglePreview()}
                      className="font-mono text-xs text-white/40 hover:text-white cursor-pointer px-2"
                    >
                      ✕ CLOSE
                    </button>
                  </div>
                )}

                {/* Calibration Coefficient Override Controller */}
                {selectedUnlocked && (
                  <div className="border border-[#39FF14]/30 bg-black/50 p-5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-white/50 flex items-center gap-2 font-bold">
                        <Sliders size={14} className="text-[#39FF14]" />
                        <span>// CALIBRATION COEFFICIENT OVERRIDE</span>
                      </div>
                      <div className="font-mono font-black text-base" style={{ color: diffColor }}>
                        LVL {diffOverride}
                      </div>
                    </div>

                    <div className="flex gap-1.5 items-end h-5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-xs transition-all"
                          style={{
                            height: `${30 + i * 7}%`,
                            background: i < diffOverride ? diffColor : 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            boxShadow: i < diffOverride ? `0 0 8px ${diffColor}50` : 'none',
                          }}
                        />
                      ))}
                    </div>

                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={diffOverride}
                      onChange={(e) => {
                        audioManager.playSfx('tap_nav', 0.05);
                        setDiffOverride(parseInt(e.target.value, 10));
                      }}
                      className="w-full cursor-pointer accent-[#39FF14]"
                    />

                    <div className="flex justify-between font-mono text-[9px] tracking-widest text-white/40 font-bold">
                      <span className="text-[#39FF14]">MIN COEFFICIENT (LVL 1)</span>
                      <span className="text-[#FF1493]">MAX COEFFICIENT (LVL 10)</span>
                    </div>
                  </div>
                )}

                {/* Telemetry Stats Grid */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'BPM', value: selected.bpm },
                    { label: 'NODES', value: (selected.notes || []).length },
                    { label: 'LENGTH', value: `${Math.floor(selected.duration / 60)}:${String(Math.round(selected.duration % 60)).padStart(2, '0')}` },
                    { label: 'CALIB', value: diffOverride },
                  ].map(({ label, value }) => (
                    <div key={label} className="border border-white/10 bg-black/40 p-3.5 rounded-xl text-center">
                      <div className="font-mono text-[9px] font-bold text-white/30 uppercase mb-1">{label}</div>
                      <div className="font-mono font-black text-lg text-[#39FF14]">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Highest Integrity Dispatch Score */}
                {getHighScore(selected.id) > 0 && (
                  <div className="border border-[#39FF14]/20 bg-black/40 p-4 rounded-xl flex items-center justify-between">
                    <div className="font-mono text-[10px] tracking-widest text-white/40 uppercase font-bold">
                      // MAX DISPATCH SCORE
                    </div>
                    <div className="font-mono font-black text-xl text-[#39FF14]">
                      {getHighScore(selected.id).toLocaleString()}
                    </div>
                  </div>
                )}

                {/* Prize Progress Menu */}
                <PrizeProgressMenu songId={selected.id} />

                {/* Telemetry History */}
                {history.length > 0 && (
                  <div className="border border-white/10 bg-black/30 p-4 rounded-xl space-y-2">
                    <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase font-bold">
                      // TELEMETRY HISTORY LOG ({history.length} TRANSMISSIONS)
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 font-mono text-xs">
                      {history.slice(-6).map((sc, idx) => (
                        <div key={idx} className="border border-white/10 bg-white/5 px-3 py-1.5 rounded text-[#39FF14] font-bold">
                          {sc.toLocaleString()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transmission Trigger / Play Action */}
                <div className="pt-4">
                  {!selectedUnlocked ? (
                    <div className="border border-[#FF3800]/40 bg-[#FF3800]/10 p-4 rounded-xl text-center mb-4">
                      <div className="font-mono text-xs font-black text-[#FF3800] tracking-wider uppercase">
                        AWARD PLAY LOCKED // 10 FRAGMENTS REQUIRED
                      </div>
                      <div className="font-mono text-[9px] text-white/60 mt-1 uppercase">
                        COLLECT 10 FRAGMENTS FOR THIS SONG OR EQUIP CARD FROM VAULT COLLECTION
                      </div>
                    </div>
                  ) : null}

                  <div className="flex gap-3">
                    <button
                      data-testid="button-play"
                      disabled={!selectedUnlocked}
                      onClick={() => handlePlaySong()}
                      onMouseEnter={() => { if (selectedUnlocked) audioManager.playSfx('tap_nav', 0.08); }}
                      className={`flex-1 py-5 text-sm tracking-[0.5em] font-black uppercase rounded-2xl transition-all flex items-center justify-center gap-3 cursor-pointer ${
                        selectedUnlocked
                          ? "border border-[#39FF14] bg-[#39FF14] text-black hover:bg-[#39FF14]/90 shadow-[0_0_24px_rgba(57,255,20,0.5)] hover:scale-[1.01]"
                          : "border border-white/10 bg-white/5 text-white/20 cursor-not-allowed"
                      }`}
                    >
                      <Play size={18} fill="currentColor" />
                      <span>START TRANSMISSION</span>
                    </button>

                    {import.meta.env.DEV && (
                      <button
                        disabled={!selectedUnlocked}
                        onClick={() => {
                          if (!selected) return;
                          sessionStorage.setItem(`export_video_${selected.id}`, 'true');
                          handlePlaySong();
                        }}
                        onMouseEnter={() => { if (selectedUnlocked) audioManager.playSfx('tap_nav', 0.08); }}
                        title="Export frame-perfect 100% PERFECT+ run video (DEV SERVER ONLY)"
                        className={`px-6 py-5 text-xs tracking-[0.25em] font-mono font-bold uppercase rounded-2xl transition-all flex items-center justify-center gap-2.5 cursor-pointer border ${
                          selectedUnlocked
                            ? "border-[#FF1493] bg-[#FF1493]/15 text-[#FF1493] hover:bg-[#FF1493] hover:text-black shadow-[0_0_20px_rgba(255,20,147,0.3)] hover:scale-[1.01]"
                            : "border-white/10 bg-white/5 text-white/20 cursor-not-allowed"
                        }`}
                      >
                        <Film size={18} />
                        <span className="hidden sm:inline">EXPORT PERFECT VIDEO</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-24 opacity-30">
                <div className="w-14 h-14 border-2 border-dashed border-[#39FF14] rounded-full animate-spin" />
                <div className="font-mono text-xs font-bold tracking-[0.3em] uppercase text-[#39FF14]">
                  SELECT A STAGE TO INITIATE CALIBRATION...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
