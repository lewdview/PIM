import { useLocation } from "wouter";
import { useState, useEffect, useMemo, useRef } from "react";
import { loadCatalog, isSongTimeLocked, getModifierForSong } from "@/game/api";
import type { GameSong } from "@/game/api";
import { audioManager } from "@/game/audio";
import { getActiveTheme } from "@/lib/options";
import { useVaultStore } from "../store/useVaultStore";
import { getCurrentDay, getMonthNumFromDay } from "../utils/dayCalc";
import { CHAPTERS, type ChapterMeta } from "@/game/campaign";
import { getMedalForSong, getHighScore, getScoreHistory } from "@/game/progress";
import PrizeProgressMenu from "../components/PrizeProgressMenu";
import { Lock, Unlock, Play, Sliders, Music, Volume2, VolumeX, Activity, Award, Trophy, ChevronRight } from "lucide-react";
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

function DiffBars({ level }: { level: number }) {
  return (
    <div className="flex gap-px items-end" style={{ height: 14 }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="rounded-sm"
          style={{
            width: 4,
            height: `${30 + i * 7}%`,
            background: i < level ? DIFF_COLORS[Math.min(i, 9)] : 'rgba(255,255,255,0.07)',
            boxShadow: i < level ? `0 0 4px ${DIFF_COLORS[Math.min(i, 9)]}40` : 'none',
          }}
        />
      ))}
    </div>
  );
}

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
  const [selected, setSelected] = useState<GameSong | null>(null);
  const [activeMonth, setActiveMonth] = useState<number | 'all'>('all');
  
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
  const containerRef = useRef<HTMLDivElement>(null);
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
        const defaultSong = released[released.length - 1];
        setSelected(defaultSong);
        setDiffOverride(defaultSong.difficultyLevel);
        setHistory(getScoreHistory(defaultSong.id));
      }
      setLoading(false);
    });
  }, []);

  // Update calibration when selected song changes
  useEffect(() => {
    if (selected) {
      const savedOverride = sessionStorage.getItem(`diff_override_${selected.id}`);
      if (savedOverride) {
        setDiffOverride(parseInt(savedOverride, 10));
      } else {
        setDiffOverride(selected.difficultyLevel);
      }
      setHistory(getScoreHistory(selected.id));
      // Cleanup preview when changing selection
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

  // Track scroll position for parallax background animation
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      setScrollTop(target.scrollTop);
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (el) el.removeEventListener('scroll', handleScroll);
    };
  }, [loading]);

  // Group songs into month chapters
  const monthGroups = useMemo(() => {
    return CHAPTERS.map((meta) => {
      const monthSongs = songs.filter(s => {
        if (s.day !== undefined) return getMonthNumFromDay(s.day) === meta.month;
        if (!s.date) return false;
        const parts = s.date.split('-');
        return parts.length > 1 && parseInt(parts[1], 10) === meta.month;
      });

      const clearedCount = monthSongs.filter(s => getHighScore(s.id) > 0).length;

      return {
        meta,
        songs: monthSongs,
        clearedCount,
      } as MonthGroupData;
    });
  }, [songs]);

  // Filtered list based on search/mood/sort/activeMonth
  const filteredMonthGroups = useMemo(() => {
    return monthGroups.map(group => {
      if (activeMonth !== 'all' && group.meta.month !== activeMonth) {
        return { ...group, songs: [] };
      }

      let list = group.songs;
      if (moodFilter !== 'all') list = list.filter((s) => s.mood === moodFilter);
      if (search.trim()) {
        const q = search.toLowerCase();
        list = list.filter((s) => s.title.toLowerCase().includes(q) || String(s.day).includes(q) || s.artist.toLowerCase().includes(q));
      }
      if (sortBy === 'bpm') list = [...list].sort((a, b) => b.bpm - a.bpm);

      return {
        ...group,
        songs: list,
      };
    }).filter(group => group.songs.length > 0 || (activeMonth !== 'all' && group.meta.month === activeMonth));
  }, [monthGroups, activeMonth, moodFilter, search, sortBy]);

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

  return (
    <div className="min-h-dvh w-full flex flex-col relative overflow-hidden select-none bg-[#050402] text-white">
      {/* Dynamic Parallax Blurred Background Engine */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 transition-all duration-1000 ease-out filter blur-[12px] brightness-[0.2] scale-[1.3]"
          style={{
            backgroundImage: `url(${activeCoverUrl})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        />
        {/* Pulsing Theme Glow */}
        <div
          className="absolute inset-0 opacity-40 mix-blend-screen transition-all duration-1000"
          style={{
            background: `radial-gradient(circle at 60% 40%, ${activeMoodColor}22 0%, transparent 80%)`,
          }}
        />
        {/* Sector Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
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
          PIM // MONTH ARCHIVES
        </div>
      </header>

      {/* Month Filter Selector Bar */}
      <div
        className="relative z-20 flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto scrollbar-none border-b border-white/5 flex-shrink-0"
        style={{ background: 'rgba(5,5,5,0.7)', backdropFilter: 'blur(10px)', scrollbarWidth: 'none' }}
      >
        <button
          onClick={() => {
            audioManager.playSfx('tap_nav', 0.1);
            setActiveMonth('all');
          }}
          className="font-mono text-[9px] font-bold px-3 py-1.5 tracking-wider uppercase transition-all flex-shrink-0 cursor-pointer"
          style={{
            background: activeMonth === 'all' ? (isAvant ? '#39FF14' : 'linear-gradient(135deg, #FF1493, #FF8A00)') : 'rgba(255,255,255,0.03)',
            color: activeMonth === 'all' ? '#000' : 'rgba(255,255,255,0.4)',
            border: `1px solid ${activeMonth === 'all' ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
            boxShadow: activeMonth === 'all' ? '0 0 12px rgba(57,255,20,0.3)' : 'none',
          }}
        >
          ALL MONTHS ({songs.length})
        </button>

        {CHAPTERS.map((ch) => {
          const count = songs.filter(s => getMonthNumFromDay(s.day) === ch.month).length;
          const isActive = activeMonth === ch.month;
          return (
            <button
              key={ch.month}
              onClick={() => {
                audioManager.playSfx('tap_nav', 0.1);
                setActiveMonth(ch.month);
              }}
              className="font-mono text-[9px] font-bold px-3 py-1.5 tracking-wider uppercase transition-all flex-shrink-0 flex items-center gap-1.5 cursor-pointer"
              style={{
                background: isActive ? ch.dc : 'rgba(255,255,255,0.03)',
                color: isActive ? '#000' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${isActive ? ch.dc : 'rgba(255,255,255,0.08)'}`,
                boxShadow: isActive ? `0 0 12px ${ch.dc}60` : 'none',
              }}
            >
              <span>M{String(ch.month).padStart(2, '0')}</span>
              <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Month Sectors + Songs Matrix */}
        <div className="w-full lg:w-1/2 flex flex-col border-r border-white/10 overflow-hidden">
          {/* Controls / Filter Bar */}
          <div className="p-4 space-y-3 border-b border-white/10 bg-black/40 flex-shrink-0">
            <div className="relative">
              <input
                data-testid="input-search"
                type="text"
                placeholder="SEARCH ARCHIVE DISPATCHES..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onMouseEnter={() => audioManager.playSfx("tap_nav", 0.03)}
                className="w-full font-mono text-xs tracking-widest px-10 py-2.5 outline-none transition-all"
                style={{
                  background: 'rgba(5,5,5,0.8)',
                  border: isAvant ? '1px solid rgba(57,255,20,0.3)' : '1px solid rgba(255,255,255,0.15)',
                  color: '#F2EDE5',
                }}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-[#39FF14]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
            </div>

            <div className="flex gap-2 items-center justify-between">
              <div className="flex gap-1.5">
                {(['all', 'light', 'dark'] as const).map((m) => (
                  <button
                    key={m}
                    data-testid={`filter-mood-${m}`}
                    onClick={() => { audioManager.playSfx('tap_nav', 0.12); setMoodFilter(m); }}
                    className="font-mono text-[9px] font-bold px-3 py-1 tracking-widest transition-all uppercase cursor-pointer"
                    style={{
                      background: moodFilter === m ? (isAvant ? '#39FF14' : '#FF1493') : 'rgba(255,255,255,0.04)',
                      color: moodFilter === m ? '#000' : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${moodFilter === m ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button
                data-testid="sort-bpm"
                onClick={() => { audioManager.playSfx('tap_nav', 0.12); setSortBy(sortBy === 'day' ? 'bpm' : 'day'); }}
                className="font-mono text-[9px] font-bold px-3 py-1 tracking-widest transition-all uppercase cursor-pointer text-white/50 hover:text-white border border-white/10 hover:border-white/30"
              >
                ↕ {sortBy === 'day' ? 'CHRONO' : 'BPM'}
              </button>
            </div>
          </div>

          {/* Month Sectors Scroll Viewport */}
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth scrollbar-none"
            style={{ scrollbarWidth: 'none' }}
          >
            {filteredMonthGroups.map((group) => {
              const monthTitleY = (scrollTop * 0.15) % 100;
              const gridY = (scrollTop * 0.08) % 50;

              return (
                <div
                  key={group.meta.month}
                  className="relative border border-white/10 rounded-2xl p-5 overflow-hidden transition-all duration-300"
                  style={{
                    background: `radial-gradient(circle at 10% 20%, ${group.meta.dc}0d 0%, rgba(5,5,5,0.6) 100%)`,
                  }}
                >
                  {/* Giant Parallax Month Text in Sector Background */}
                  <div
                    className="absolute right-2 -bottom-4 font-mono font-black select-none pointer-events-none text-[18vw] lg:text-[10vw] tracking-tighter leading-none opacity-10 transition-transform duration-300"
                    style={{
                      color: group.meta.dc,
                      WebkitTextStroke: `1.5px ${group.meta.dc}40`,
                      transform: `translateY(${monthTitleY}px)`,
                    }}
                  >
                    M{String(group.meta.month).padStart(2, '0')}
                  </div>

                  {/* Parallax Floating Album Art Grid Overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden flex items-center justify-center scale-110"
                    style={{ transform: `translateY(${gridY}px)` }}
                  >
                    <div className="grid grid-cols-4 gap-2 w-full h-full p-4 -rotate-6">
                      {group.songs.slice(0, 8).map((s, idx) => (
                        s.coverArt ? (
                          <img key={idx} src={s.coverArt} alt="" className="w-full aspect-square object-cover rounded filter grayscale" />
                        ) : null
                      ))}
                    </div>
                  </div>

                  {/* Sector Header */}
                  <div className="relative z-10 flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]"
                        style={{ background: group.meta.dc, color: group.meta.dc }}
                      />
                      <div>
                        <div className="font-mono text-[9px] font-bold tracking-[0.25em] text-white/40 uppercase">
                          CHAPTER {String(group.meta.month).padStart(2, '0')} // SECTOR
                        </div>
                        <h3 className="font-mono font-black text-base uppercase tracking-tight text-white flex items-center gap-2">
                          <span>{group.meta.name}</span>
                        </h3>
                      </div>
                    </div>
                    <div className="font-mono text-right text-[10px] text-white/50">
                      <span className="text-[#39FF14] font-bold">{group.clearedCount}</span> / {group.songs.length} CLEARED
                    </div>
                  </div>

                  {/* Songs list in Sector */}
                  <div className="relative z-10 space-y-2">
                    {group.songs.length === 0 ? (
                      <div className="font-mono text-xs text-white/30 italic py-4 text-center">
                        NO DISPATCH SIGNALS FOUND IN THIS SECTOR
                      </div>
                    ) : (
                      group.songs.map((song) => {
                        const isSelected = selected?.id === song.id;
                        const unlocked = isSongUnlocked(song);
                        const hs = getHighScore(song.id);
                        const songMedal = getMedalForSong(song.id);
                        const moodColor = song.mood === 'light' ? '#39FF14' : '#FF1493';

                        return (
                          <div
                            key={song.id}
                            data-testid={`card-song-${song.id}`}
                            onClick={() => {
                              audioManager.playSfx('tap_nav', 0.12);
                              setSelected(song);
                            }}
                            className={`w-full text-left flex items-center gap-3.5 p-3 rounded-xl transition-all duration-200 cursor-pointer relative group ${
                              isSelected ? 'bg-white/10 border-l-4 shadow-xl' : 'bg-black/40 hover:bg-white/5 border-l-4 border-transparent'
                            }`}
                            style={{
                              borderLeftColor: isSelected ? moodColor : 'transparent',
                              boxShadow: isSelected ? `0 8px 24px -6px ${moodColor}30` : 'none',
                            }}
                          >
                            {/* Song Artwork Cover */}
                            <div className="relative flex-shrink-0">
                              {song.coverArt ? (
                                <img
                                  src={song.coverArt}
                                  alt={song.title}
                                  className="w-12 h-12 object-cover rounded-lg transition-transform group-hover:scale-105"
                                  style={{
                                    border: isSelected ? `1px solid ${moodColor}` : '1px solid rgba(255,255,255,0.1)',
                                    filter: unlocked ? 'none' : 'grayscale(100%) brightness(0.4)',
                                  }}
                                />
                              ) : (
                                <div
                                  className="w-12 h-12 rounded-lg flex items-center justify-center font-mono font-bold text-xs bg-white/5 border border-white/10"
                                  style={{ color: moodColor }}
                                >
                                  #{song.day}
                                </div>
                              )}
                              {!unlocked && (
                                <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                                  <Lock size={14} className="text-[#FF3800]" />
                                </div>
                              )}
                            </div>

                            {/* Song Meta Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-mono text-[9px] font-bold text-white/30">
                                  #{String(song.day).padStart(3, '0')}
                                </span>
                                {unlocked ? (
                                  <span
                                    className="font-mono text-[8px] px-1.5 py-[1px] font-black uppercase rounded"
                                    style={{
                                      color: moodColor,
                                      border: `1px solid ${moodColor}40`,
                                      background: `${moodColor}10`,
                                    }}
                                  >
                                    {song.mood}
                                  </span>
                                ) : (
                                  <span className="font-mono text-[8px] px-1.5 py-[1px] font-black uppercase text-[#FF3800] border border-[#FF3800]/40 bg-[#FF3800]/10 rounded">
                                    LOCKED
                                  </span>
                                )}
                                {songMedal && songMedal !== '' && (
                                  <span
                                    className="font-mono text-[8px] px-1.5 py-[1px] font-black uppercase rounded ml-auto"
                                    style={{ color: MEDAL_COLOR[songMedal], border: `1px solid ${MEDAL_COLOR[songMedal]}40` }}
                                  >
                                    {songMedal}
                                  </span>
                                )}
                              </div>

                              <div className="font-mono font-black text-sm uppercase truncate text-white tracking-tight flex items-center gap-1.5">
                                <span>{song.title}</span>
                                {claimedRewards[song.id]?.includes('prophecy') && <span>🏆</span>}
                              </div>

                              <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-white/40">
                                <span>{song.artist}</span>
                                <span>·</span>
                                <span>{song.bpm} BPM</span>
                                <span>·</span>
                                <span>LVL {song.difficultyLevel}</span>
                                {hs > 0 && (
                                  <span className="ml-auto font-mono text-[10px] font-bold text-[#39FF14]">
                                    {hs.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>

                            <ChevronRight size={16} className={`transition-transform ${isSelected ? 'translate-x-1 text-[#39FF14]' : 'text-white/20'}`} />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Dynamic Integrated Calibration & Details Page */}
        <div className="w-full lg:w-1/2 flex flex-col overflow-y-auto p-6 lg:p-10 bg-black/60 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-white/10">
          {selected ? (
            <div className="space-y-6 max-w-xl mx-auto w-full">
              {/* Header Title Bar */}
              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div>
                  <div className="font-mono text-[9px] tracking-[0.25em] text-[#39FF14] uppercase mb-1 flex items-center gap-2">
                    <Activity size={12} className="animate-pulse" />
                    <span>SYSTEM ANALYZER // CALIBRATION ACTIVE</span>
                  </div>
                  <div className="font-mono text-xs text-white/30 uppercase">
                    SIGNAL REF: {selected.id.toUpperCase().substring(0, 14)}
                  </div>
                </div>
                <div
                  className="font-mono text-[9px] font-bold px-3 py-1 border uppercase rounded"
                  style={{ color: activeMoodColor, borderColor: `${activeMoodColor}40`, background: `${activeMoodColor}10` }}
                >
                  MOOD: {selected.mood.toUpperCase()}
                </div>
              </div>

              {/* Album Art & Audio Preview Hero */}
              <div className="flex flex-col sm:flex-row gap-6 items-center bg-white/[0.02] border border-white/10 p-5 rounded-2xl">
                <div className="relative flex-shrink-0 group">
                  {/* Tech frame accents */}
                  <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-[#39FF14]" />
                  <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-[#39FF14]" />
                  <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-[#39FF14]" />
                  <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-[#39FF14]" />

                  {selected.coverArt ? (
                    <img
                      src={selected.coverArt}
                      alt={selected.title}
                      className="w-36 h-36 object-cover rounded-xl shadow-2xl"
                      style={{
                        border: '1px solid rgba(57,255,20,0.2)',
                        filter: selectedUnlocked ? 'none' : 'grayscale(100%) brightness(0.4)',
                      }}
                    />
                  ) : (
                    <div className="w-36 h-36 rounded-xl flex items-center justify-center font-mono font-black text-3xl bg-white/5 border border-white/10 text-white/30">
                      #{selected.day}
                    </div>
                  )}

                  {/* Audio Preview Overlay Button */}
                  {selectedUnlocked && (
                    <button
                      onClick={() => togglePreview(selected)}
                      className="absolute inset-0 rounded-xl flex items-center justify-center transition-all bg-black/40 hover:bg-black/60 text-white cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full border border-white/30 bg-black/60 flex items-center justify-center shadow-lg">
                        {previewing ? <VolumeX size={18} className="text-[#39FF14]" /> : <Volume2 size={18} className="text-white" />}
                      </div>
                    </button>
                  )}
                </div>

                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex items-center gap-2 mb-1.5 justify-center sm:justify-start flex-wrap">
                    <span className="font-mono text-[9px] px-2 py-0.5 border font-bold uppercase rounded text-white/40 border-white/20">
                      DAY #{String(selected.day).padStart(3, '0')}
                    </span>
                    {medal && medal !== '' && (
                      <span
                        className="font-mono text-[9px] px-2 py-0.5 border font-bold uppercase rounded"
                        style={{ color: medalColor, borderColor: `${medalColor}40`, background: `${medalColor}10` }}
                      >
                        {medal}
                      </span>
                    )}
                    {isAllPrizesClaimed && (
                      <span className="font-mono text-[9px] px-2 py-0.5 border border-yellow-400 text-yellow-400 bg-yellow-400/10 font-bold uppercase flex items-center gap-1 rounded">
                        <Trophy size={10} /> ALL PRIZES CLAIMED
                      </span>
                    )}
                  </div>

                  <h2 className="font-mono font-black text-2xl uppercase leading-tight tracking-tight text-white mb-1">
                    {selected.title}
                  </h2>
                  <div className="font-mono text-sm text-white/60 font-bold uppercase mb-1">
                    {selected.artist}
                  </div>
                  <div className="font-mono text-[10px] text-white/30 uppercase">
                    SPEC DATE: {selected.date} {selected.key ? `// KEY: ${selected.key}` : ''}
                  </div>
                </div>
              </div>

              {/* Audio Preview Waveform Bar */}
              {previewing && selectedUnlocked && (
                <div className="border border-[#39FF14]/30 bg-black/70 p-3.5 rounded-xl flex items-center gap-4">
                  <WaveformBars playing={previewing} />
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-150"
                      style={{ width: `${previewProg * 100}%`, background: activeMoodColor, boxShadow: `0 0 8px ${activeMoodColor}` }}
                    />
                  </div>
                  <button
                    onClick={() => togglePreview()}
                    className="font-mono text-xs text-white/40 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Calibration Coefficient Override Controller */}
              {selectedUnlocked && (
                <div className="border border-[#39FF14]/25 bg-black/40 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-white/40 flex items-center gap-2">
                      <Sliders size={12} className="text-[#39FF14]" />
                      <span>// CALIBRATION COEFFICIENT OVERRIDE</span>
                    </div>
                    <div className="font-mono font-bold text-sm" style={{ color: diffColor }}>
                      LVL {diffOverride}
                    </div>
                  </div>

                  <div className="flex gap-1 items-end h-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-xs transition-all"
                        style={{
                          height: `${30 + i * 7}%`,
                          background: i < diffOverride ? diffColor : 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          boxShadow: i < diffOverride ? `0 0 6px ${diffColor}40` : 'none',
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

                  <div className="flex justify-between font-mono text-[8px] tracking-widest text-white/40">
                    <span className="text-[#39FF14]">MIN COEFFICIENT (LVL 1)</span>
                    <span className="text-[#FF1493]">MAX COEFFICIENT (LVL 10)</span>
                  </div>
                </div>
              )}

              {/* Telemetry Stats Grid */}
              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { label: 'BPM', value: selected.bpm },
                  { label: 'NODES', value: (selected.notes || []).length },
                  { label: 'LENGTH', value: `${Math.floor(selected.duration / 60)}:${String(Math.round(selected.duration % 60)).padStart(2, '0')}` },
                  { label: 'CALIB', value: diffOverride },
                ].map(({ label, value }) => (
                  <div key={label} className="border border-white/10 bg-black/40 p-3 rounded-xl text-center">
                    <div className="font-mono text-[8px] font-bold text-white/30 uppercase mb-1">{label}</div>
                    <div className="font-mono font-black text-sm text-[#39FF14]">{value}</div>
                  </div>
                ))}
              </div>

              {/* Highest Integrity Dispatch Score */}
              {getHighScore(selected.id) > 0 && (
                <div className="border border-[#39FF14]/20 bg-black/40 p-4 rounded-xl flex items-center justify-between">
                  <div className="font-mono text-[9px] tracking-widest text-white/40 uppercase">
                    // MAX DISPATCH SCORE
                  </div>
                  <div className="font-mono font-black text-lg text-[#39FF14]">
                    {getHighScore(selected.id).toLocaleString()}
                  </div>
                </div>
              )}

              {/* Description */}
              {selected.description && (
                <div className="border border-white/10 bg-black/30 p-4 rounded-xl font-mono text-xs italic text-white/50 leading-relaxed">
                  "{selected.description.toUpperCase()}"
                </div>
              )}

              {/* Prize Progress Menu */}
              <PrizeProgressMenu songId={selected.id} />

              {/* Telemetry Log */}
              {history.length > 0 && (
                <div className="border border-white/10 bg-black/30 p-4 rounded-xl space-y-2">
                  <div className="font-mono text-[8px] text-white/40 tracking-widest uppercase">
                    // TELEMETRY HISTORY LOG ({history.length} TRANSMISSIONS)
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 font-mono text-xs">
                    {history.slice(-6).map((sc, idx) => (
                      <div key={idx} className="border border-white/10 bg-white/5 px-2.5 py-1 rounded text-[#39FF14] font-bold">
                        {sc.toLocaleString()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transmission Trigger / Play Action */}
              <div className="pt-2">
                {!selectedUnlocked ? (
                  <div className="border border-[#FF3800]/40 bg-[#FF3800]/10 p-4 rounded-xl text-center mb-3">
                    <div className="font-mono text-xs font-black text-[#FF3800] tracking-wider uppercase">
                      AWARD PLAY LOCKED // 10 FRAGMENTS REQUIRED
                    </div>
                    <div className="font-mono text-[9px] text-white/60 mt-1 uppercase">
                      COLLECT 10 FRAGMENTS FOR THIS SONG OR EQUIP CARD FROM VAULT COLLECTION
                    </div>
                  </div>
                ) : null}

                <button
                  data-testid="button-play"
                  disabled={!selectedUnlocked}
                  onClick={() => handlePlaySong()}
                  onMouseEnter={() => { if (selectedUnlocked) audioManager.playSfx('tap_nav', 0.08); }}
                  className={`w-full py-4 text-xs tracking-[0.4em] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer ${
                    selectedUnlocked
                      ? "border border-[#39FF14] bg-[#39FF14] text-black hover:bg-[#39FF14]/90 shadow-[0_0_20px_rgba(57,255,20,0.4)]"
                      : "border border-white/10 bg-white/5 text-white/20 cursor-not-allowed"
                  }`}
                >
                  <Play size={16} fill="currentColor" />
                  <span>START TRANSMISSION</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16 opacity-30">
              <div className="w-12 h-12 border-2 border-dashed border-[#39FF14] rounded-full animate-spin" />
              <div className="font-mono text-xs font-bold tracking-[0.3em] uppercase text-[#39FF14]">
                SELECT A SIGNAL TO INITIATE CALIBRATION...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
