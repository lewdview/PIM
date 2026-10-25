import { useLocation } from "wouter";
import { useState, useEffect, useMemo, useRef } from "react";
import { loadCatalog, isSongTimeLocked, getModifierForSong } from "@/game/api";
import type { GameSong } from "@/game/api";
import { audioManager } from "@/game/audio";
import { getActiveTheme } from "@/lib/options";
import { useVaultStore, ownsCardForDay, isAwardPlayUnlocked, getShardsForDay, AWARD_PLAY_SHARD_THRESHOLD } from "../store/useVaultStore";
import { getCurrentDay, getMonthNumFromDay, getRelativeDay } from "../utils/dayCalc";
import { CHAPTERS, type ChapterMeta } from "@/game/campaign";
import { getMedalForSong, getHighScore, getScoreHistory } from "@/game/progress";
import PrizeProgressMenu from "../components/PrizeProgressMenu";
import { getBombshellDayCovers, getBombshellCoverUrl, getCustomBombshellCover, setCustomBombshellCover } from "../utils/bombshellCards";
import { clearPrimedGameCover, primeGameCover, resolvePreferredCover } from "../utils/gameCover";
import { getCoverUrlForRarity } from "../utils/rarityArtwork";
import { Lock, Unlock, Play, Sliders, Music, Volume2, VolumeX, Activity, Award, Trophy, ChevronLeft, ChevronRight, Film, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";
import { DELUXE_UNLOCK_ACCURACY, deluxeSongId, isDeluxeUnlocked, loadEarnedDeluxeDays } from "@/lib/deluxe";

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
  const userId = useAuthStore((s) => s.user?.id);
  // Bumped once earned Deluxe unlocks have loaded, so the Deluxe button re-checks
  const [, setDeluxeLoaded] = useState(0);
  useEffect(() => {
    let alive = true;
    loadEarnedDeluxeDays(userId).then(() => { if (alive) setDeluxeLoaded((n) => n + 1); });
    return () => { alive = false; };
  }, [userId]);

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

  // Update calibration & score history when selected song changes.
  // Always reset to the song's canonical difficulty. A saved override may have
  // been written by the campaign page (Chapter.tsx), where the value is the
  // chapter-scaled difficulty — restoring it here silently voids award
  // eligibility ("AWARDS DISABLED // MODIFIER ACTIVE OR DIFF OVERRIDE") even
  // though the player never touched the slider.
  useEffect(() => {
    if (selected) {
      setDiffOverride(selected.difficultyLevel);
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

  // Playback requires card ownership. Today's track is free via the
  // claim-first funnel (silent-claim runs in handlePlaySong before routing).
  const isSongUnlocked = (song: GameSong) => {
    if (song.day === today) return true;
    return ownsCardForDay(collection, song.day);
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

  const availableVariants = useMemo(() => {
    if (!selected) return [];
    const list: { label: string; url: string; fileName?: string }[] = [];
    if (selected.coverArt) {
      list.push({ label: 'ORIGINAL', url: selected.coverArt });
    }
    const dayCovers = getBombshellDayCovers(selected.day);
    const allFiles = [...(dayCovers?.lbFiles || []), ...(dayCovers?.normalFiles || [])];
    allFiles.forEach((file, idx) => {
      const url = getBombshellCoverUrl(selected.day, file);
      const isLB = file.toLowerCase().startsWith('lb');
      list.push({
        label: isLB ? `LB #${idx + 1}` : `VAR #${idx + 1}`,
        url,
        fileName: file,
      });
    });
    if (selected.coverArt) {
      const altUrl = getCoverUrlForRarity(selected.coverArt, 'uncommon');
      if (altUrl && altUrl !== selected.coverArt && !list.some(v => v.url === altUrl)) {
        list.push({ label: 'ENHANCED', url: altUrl });
      }
      const girlUrl = getCoverUrlForRarity(selected.coverArt, 'rare');
      if (girlUrl && girlUrl !== selected.coverArt && !list.some(v => v.url === girlUrl)) {
        list.push({ label: 'PRISM', url: girlUrl });
      }
    }
    return list;
  }, [selected]);

  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(0);

  useEffect(() => {
    if (!selected || availableVariants.length === 0) {
      setSelectedVariantIdx(0);
      return;
    }
    const savedPref = getCustomBombshellCover(selected.day) || (typeof localStorage !== 'undefined' ? localStorage.getItem(`preferred_cover_${selected.id}`) : null);
    if (savedPref) {
      const idx = availableVariants.findIndex(v => v.fileName === savedPref || v.url === savedPref);
      if (idx >= 0) {
        setSelectedVariantIdx(idx);
        return;
      }
    }
    setSelectedVariantIdx(0);
  }, [selected?.id, availableVariants]);

  const activeCoverUrl = availableVariants[selectedVariantIdx]?.url || selected?.coverArt || '/data/covers/default.jpg';

  const handlePlaySong = async (songToPlay?: GameSong, deluxe = false) => {
    const s = songToPlay || selected;
    if (!s || !isSongUnlocked(s)) return;
    const playId = deluxe ? deluxeSongId(s.day) : s.id;
    // Claim-first funnel: today's free card is claimed silently before entering play,
    // so the destination ownership gate always sees it.
    if (s.day === today && !ownsCardForDay(collection, s.day)) {
      try {
        await useVaultStore.getState().silentClaimDailyDrop(s.day);
      } catch (err) {
        console.error("[SongSelect] Claim-first failed:", err);
      }
    }
    cleanupPreview();
    audioManager.playSfx('tap_nav', 0.4);
    sessionStorage.setItem(`game_origin_${playId}`, 'songs');
    sessionStorage.setItem(`diff_override_${playId}`, String(diffOverride));
    // Hand the variant on screen to PIM: it drives the artwork lane colors and the results art.
    primeGameCover(s.day, s.id === selected?.id ? activeCoverUrl : resolvePreferredCover(s));
    
    const modifierType = getModifierForSong(s);
    const isEquipped = equippedCardId === s.id;
    if (isEquipped && modifierType !== 'none') {
      sessionStorage.setItem(`active_modifier_type_${playId}`, modifierType);
    } else {
      sessionStorage.removeItem(`active_modifier_type_${playId}`);
    }

    setLocation(`/play/${playId}`);
  };

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
        className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3 flex-shrink-0"
        style={{
          background: 'linear-gradient(180deg, rgba(22, 16, 34, 0.94), rgba(11, 8, 18, 0.96))',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.14)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 18px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <button
            data-testid="button-back"
            onClick={() => {
              audioManager.playSfx("back", 0.5);
              setLocation("/arcade");
            }}
            onMouseEnter={() => audioManager.playSfx("tap_nav", 0.08)}
            className="btn-3d font-mono text-xs tracking-wider uppercase"
            data-tone="acid"
            data-size="sm"
          >
            ← ARCADE
          </button>
          <button
            onClick={() => {
              audioManager.playSfx("tap_nav", 0.12);
              setLocation("/campaign");
            }}
            onMouseEnter={() => audioManager.playSfx("tap_nav", 0.08)}
            className="hidden sm:inline-flex btn-3d font-mono text-xs tracking-wider uppercase"
            data-tone="quiet"
            data-size="sm"
          >
            SECTOR MAP →
          </button>
        </div>

        <div className="hw-badge">
          <span className="hw-led" data-color="acid" />
          <span>AWARD PLAY ARCHIVE // {songs.length} SIGNALS</span>
        </div>

        <div className="font-mono text-[10px] font-bold text-white/45 tracking-[0.22em] hidden md:block uppercase">
          PIM // STAGE SHOWCASE
        </div>
      </header>

      {/* Main Split Layout: Left (Month Selection 01-12) & Right (Full-Space Active Stage Showcase) */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT COLUMN: Month Selection Rack (Month 01 - 12) */}
        <div
          className="w-full md:w-68 lg:w-76 flex-shrink-0 border-r border-white/12 flex flex-col backdrop-blur-xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(16, 12, 24, 0.92), rgba(9, 7, 15, 0.96))',
            boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-black/30">
            <div className="font-mono text-[10px] font-bold tracking-[0.22em] text-[#39FF14] uppercase flex items-center gap-2">
              <span className="hw-led" data-color="acid" />
              <span>// SECTOR RACK</span>
            </div>
            <span className="hw-badge">12 MONTHS</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {monthGroups.map((group) => {
              const isActive = selectedMonth === group.meta.month;
              const pct = group.songs.length > 0 ? Math.round((group.clearedCount / group.songs.length) * 100) : 0;
              return (
                <button
                  key={group.meta.month}
                  onClick={() => handleSelectMonth(group.meta.month)}
                  onMouseEnter={() => audioManager.playSfx('tap_nav', 0.04)}
                  className="w-full text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer relative group overflow-hidden"
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(38, 29, 56, 0.95), rgba(22, 17, 34, 0.98))'
                      : 'rgba(9, 7, 15, 0.65)',
                    borderColor: isActive ? group.meta.dc : 'rgba(255,255,255,0.09)',
                    borderLeftWidth: isActive ? 4 : 1,
                    borderLeftColor: isActive ? group.meta.dc : 'rgba(255,255,255,0.09)',
                    boxShadow: isActive
                      ? `inset 0 1px 0 rgba(255,255,255,0.2), 0 3px 0 #050308, 0 0 18px ${group.meta.dc}28`
                      : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 0 #050308',
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-[9px] font-black px-1.5 py-0.5 rounded uppercase"
                        style={{
                          color: isActive ? '#050308' : group.meta.dc,
                          background: isActive ? group.meta.dc : `${group.meta.dc}18`,
                          border: `1px solid ${group.meta.dc}50`,
                        }}
                      >
                        M{String(group.meta.month).padStart(2, '0')}
                      </span>
                      <span className="font-mono text-[9px] font-bold text-white/50 uppercase">
                        {group.meta.diff}
                      </span>
                    </div>

                    <span className="font-mono text-[9.5px] text-white/60 tabular-nums">
                      <strong className="text-[#39FF14]">{group.clearedCount}</strong>/{group.songs.length}
                    </span>
                  </div>

                  <div className="font-mono font-black text-sm uppercase tracking-tight text-white flex items-center justify-between">
                    <span>{group.meta.name}</span>
                    <ChevronRight size={14} className={`transition-transform ${isActive ? 'translate-x-1 text-[#39FF14]' : 'opacity-30'}`} />
                  </div>

                  <div className="font-mono text-[9px] text-white/45 uppercase mt-0.5 truncate">
                    {group.meta.sub}
                  </div>

                  <div className="mt-2 h-1 w-full rounded-full bg-black/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, background: group.meta.dc }}
                    />
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
          style={{
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'calc(var(--fc-safe-area-bottom, 0px) + env(safe-area-inset-bottom, 0px) + 6rem)',
          }}
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
          <div className="relative z-20 space-y-3.5 max-w-4xl mx-auto w-full mb-5">
            {/* Sector Header & Controls */}
            <div className="hw-panel flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5" data-accent="acid">
              <div>
                <div className="font-mono text-[9.5px] font-bold tracking-[0.24em] text-[#39FF14] uppercase flex items-center gap-2">
                  <span className="hw-led" data-color="acid" />
                  <span>SECTOR {String(activeMonthGroup?.meta.month).padStart(2, '0')} // STAGE SHOWCASE</span>
                </div>
                <h2 className="font-mono font-black text-xl uppercase tracking-tight text-white flex items-center gap-2 mt-1">
                  <span>{activeMonthGroup?.meta.name}</span>
                  <span className="text-xs text-white/45 font-mono font-normal">({activeMonthStages.length} STAGES)</span>
                </h2>
              </div>

              {/* Stage Counter & Prev/Next Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handlePrevStage}
                  disabled={stageIndex <= 0}
                  className="btn-3d font-mono text-xs uppercase"
                  data-tone="quiet"
                  data-size="sm"
                >
                  <ChevronLeft size={15} />
                  <span>STAGE {stageIndex > 0 ? getRelativeDay(activeMonthStages[stageIndex - 1]?.day || 1) : 1}</span>
                </button>

                <div className="hw-well font-mono text-center px-4 py-1.5">
                  <div className="text-[8px] text-white/45 uppercase font-bold tracking-widest">ACTIVE STAGE</div>
                  <div className="text-base font-black text-[#39FF14] tabular-nums">
                    {currentStageNumber} <span className="text-xs text-white/40">/ {activeMonthStages.length}</span>
                  </div>
                </div>

                <button
                  onClick={handleNextStage}
                  disabled={stageIndex >= activeMonthStages.length - 1}
                  className="btn-3d font-mono text-xs uppercase"
                  data-tone="quiet"
                  data-size="sm"
                >
                  <span>STAGE {stageIndex < activeMonthStages.length - 1 ? getRelativeDay(activeMonthStages[stageIndex + 1]?.day || 1) : activeMonthStages.length}</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {/* Quick Stage Jump Sequencer Strip (1..31) */}
            <div className="hw-well flex items-center gap-1.5 overflow-x-auto p-2.5 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
              <span className="font-mono text-[8.5px] text-white/50 tracking-widest px-2 uppercase font-bold flex-shrink-0">
                STEP PAD:
              </span>
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
                    className="hw-step-pad w-8 h-8 flex-shrink-0"
                    data-state={isSelected ? 'active' : unlocked ? 'ready' : 'locked'}
                  >
                    {sNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STAGE FULL SPACE CONTENT CARD */}
          <div
            className="hw-panel relative z-10 max-w-4xl mx-auto w-full flex-1 space-y-6 p-6 lg:p-8"
            data-accent={selected?.mood === 'light' ? 'acid' : 'magenta'}
          >
            {selected ? (
              <div className="space-y-6">
                {/* Header Title Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-4 gap-3">
                  <div>
                    <div className="font-mono text-[9.5px] font-bold tracking-[0.24em] text-[#39FF14] uppercase mb-1 flex items-center gap-2">
                      <Activity size={13} className="animate-pulse" />
                      <span>STAGE {currentStageNumber} // FULL CALIBRATION SHOWCASE</span>
                    </div>
                    <div className="font-mono text-xs text-white/40 uppercase">
                      SIGNAL REF: {selected.id.toUpperCase().substring(0, 16)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-[9.5px] font-bold px-3 py-1 border uppercase rounded-full"
                      style={{ color: activeMoodColor, borderColor: `${activeMoodColor}50`, background: `${activeMoodColor}15` }}
                    >
                      MOOD: {selected.mood.toUpperCase()}
                    </span>
                    <span className="hw-badge">
                      LVL {selected.difficultyLevel}
                    </span>
                  </div>
                </div>

                {/* Hero Stage Artwork & Details */}
                <div className="hw-well flex flex-col md:flex-row gap-7 items-center p-5 sm:p-6">
                  {/* Stage Cover Art */}
                  <div className="relative flex-shrink-0 group">
                    <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-[#39FF14]" />
                    <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-[#39FF14]" />
                    <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-[#39FF14]" />
                    <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-[#39FF14]" />

                    {selected.coverArt ? (
                      <img
                        src={activeCoverUrl}
                        alt={selected.title}
                        crossOrigin="anonymous"
                        className="w-48 h-48 md:w-56 md:h-56 object-cover rounded-2xl shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                        style={{
                          border: '1px solid rgba(255,255,255,0.22)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 0 #050308, 0 18px 36px rgba(0,0,0,0.6)',
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
                        className="absolute inset-0 rounded-2xl flex items-center justify-center transition-all bg-black/35 hover:bg-black/55 text-white cursor-pointer"
                      >
                        <div
                          className="w-14 h-14 rounded-full border border-white/35 bg-black/80 flex items-center justify-center"
                          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 0 #050308, 0 10px 24px rgba(0,0,0,0.6)' }}
                        >
                          {previewing ? <VolumeX size={24} className="text-[#39FF14]" /> : <Volume2 size={24} className="text-white" />}
                        </div>
                      </button>
                    )}

                    {/* Variant Switcher Pill */}
                    {availableVariants.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextIdx = (selectedVariantIdx + 1) % availableVariants.length;
                          setSelectedVariantIdx(nextIdx);
                          const nextVar = availableVariants[nextIdx];
                          if (nextVar?.fileName && selected) {
                            setCustomBombshellCover(selected.day, nextVar.fileName);
                            clearPrimedGameCover(selected.day);
                            try { localStorage.setItem(`preferred_cover_${selected.id}`, nextVar.fileName); } catch {}
                          }
                        }}
                        className="absolute bottom-2.5 left-2.5 z-20 px-2.5 py-1 rounded-md bg-black/90 hover:bg-black border border-[#39FF14]/60 text-[10px] font-mono font-bold tracking-wider text-[#39FF14] flex items-center gap-1.5 backdrop-blur-md shadow-xl transition-transform active:scale-95 cursor-pointer"
                        title="Click to cycle cover variant"
                      >
                        <Layers size={11} className="text-[#39FF14]" />
                        <span>{availableVariants[selectedVariantIdx]?.label} ({selectedVariantIdx + 1}/{availableVariants.length})</span>
                      </button>
                    )}
                  </div>

                  {/* Stage Meta info */}
                  <div className="flex-1 min-w-0 text-center md:text-left space-y-2.5">
                    <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap">
                      <span className="hw-badge">
                        STAGE #{currentStageNumber} · DAY {selected.day}
                      </span>
                      {medal && medal !== '' && (
                        <span
                          className="font-mono text-[10px] px-2.5 py-0.5 border font-bold uppercase rounded-full"
                          style={{ color: medalColor, borderColor: `${medalColor}50`, background: `${medalColor}18` }}
                        >
                          ★ {medal}
                        </span>
                      )}
                      {isAllPrizesClaimed && (
                        <span className="font-mono text-[10px] px-2.5 py-0.5 border border-yellow-400 text-yellow-400 bg-yellow-400/10 font-bold uppercase flex items-center gap-1 rounded-full">
                          <Trophy size={12} /> ALL PRIZES CLAIMED
                        </span>
                      )}
                    </div>

                    <h1 className="font-mono font-black text-3xl md:text-4xl uppercase leading-tight tracking-tight text-white" style={{ textShadow: '0 3px 0 rgba(0,0,0,0.6)' }}>
                      {selected.title}
                    </h1>
                    <div className="font-mono text-base text-white/75 font-bold uppercase">
                      {selected.artist}
                    </div>
                    <div className="font-mono text-xs text-white/45 uppercase">
                      RELEASE DATE: {selected.date} {selected.key ? `// KEY: ${selected.key}` : ''}
                    </div>

                    {selected.description && (
                      <p className="font-mono text-xs italic text-white/60 leading-relaxed border-l-2 border-[#39FF14]/50 pl-3 py-1 mt-2 text-left">
                        "{selected.description.toUpperCase()}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Audio Preview Waveform Bar */}
                {previewing && selectedUnlocked && (
                  <div className="hw-well p-4 flex items-center gap-4 border border-[#39FF14]/35">
                    <WaveformBars playing={previewing} />
                    <div className="flex-1 h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full transition-all duration-150"
                        style={{ width: `${previewProg * 100}%`, background: activeMoodColor, boxShadow: `0 0 10px ${activeMoodColor}` }}
                      />
                    </div>
                    <button
                      onClick={() => togglePreview()}
                      className="btn-3d font-mono text-[10px]"
                      data-tone="quiet"
                      data-size="sm"
                    >
                      ✕ STOP
                    </button>
                  </div>
                )}

                {/* Calibration Coefficient Override Controller */}
                {selectedUnlocked && (
                  <div className="hw-well p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-white/60 flex items-center gap-2 font-bold">
                        <Sliders size={14} className="text-[#39FF14]" />
                        <span>// CALIBRATION COEFFICIENT OVERRIDE</span>
                      </div>
                      <div className="font-mono font-black text-base px-2.5 py-0.5 rounded bg-black/50 border border-white/10" style={{ color: diffColor }}>
                        LVL {diffOverride}
                      </div>
                    </div>

                    <div className="flex gap-1.5 items-end h-6 p-1 rounded-lg bg-black/40 border border-white/5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-xs transition-all"
                          style={{
                            height: `${32 + i * 7.5}%`,
                            background: i < diffOverride ? diffColor : 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: i < diffOverride ? `0 0 10px ${diffColor}60` : 'none',
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

                    <div className="flex justify-between font-mono text-[9px] tracking-widest text-white/45 font-bold">
                      <span className="text-[#39FF14]">MIN COEFFICIENT (LVL 1)</span>
                      <span className="text-[#FF1E8C]">MAX COEFFICIENT (LVL 10)</span>
                    </div>
                  </div>
                )}

                {/* Telemetry Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'BPM TEMPO', value: selected.bpm, color: '#39FF14' },
                    { label: 'CHART NODES', value: (selected.notes || []).length, color: '#00E5FF' },
                    { label: 'DURATION', value: `${Math.floor(selected.duration / 60)}:${String(Math.round(selected.duration % 60)).padStart(2, '0')}`, color: '#F2F0E8' },
                    { label: 'CALIBRATION', value: `LVL ${diffOverride}`, color: diffColor },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="hw-well p-3.5 text-center">
                      <div className="font-mono text-[9px] font-bold text-white/45 tracking-wider uppercase mb-1">{label}</div>
                      <div className="font-mono font-black text-lg tabular-nums" style={{ color }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Highest Integrity Dispatch Score */}
                {getHighScore(selected.id) > 0 && (
                  <div className="hw-well p-4 flex items-center justify-between border border-[#39FF14]/30">
                    <div className="font-mono text-[10px] tracking-widest text-white/55 uppercase font-bold flex items-center gap-2">
                      <span className="hw-led" data-color="acid" />
                      <span>// MAX DISPATCH SCORE</span>
                    </div>
                    <div className="font-mono font-black text-xl text-[#39FF14] tabular-nums">
                      {getHighScore(selected.id).toLocaleString()}
                    </div>
                  </div>
                )}

                {/* Prize Progress Menu */}
                <PrizeProgressMenu songId={selected.id} />

                {/* Telemetry History */}
                {history.length > 0 && (
                  <div className="hw-well p-4 space-y-2">
                    <div className="font-mono text-[9px] text-white/45 tracking-widest uppercase font-bold">
                      // TELEMETRY HISTORY LOG ({history.length} TRANSMISSIONS)
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 font-mono text-xs">
                      {history.slice(-6).map((sc, idx) => (
                        <div key={idx} className="border border-white/12 bg-white/5 px-3 py-1.5 rounded-lg text-[#39FF14] font-bold tabular-nums">
                          {sc.toLocaleString()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transmission Trigger / Play Action */}
                <div className="pt-2">
                  {!selectedUnlocked ? (
                    <div className="hw-well border border-[#FF3800]/45 bg-[#FF3800]/10 p-4 text-center mb-4">
                      <div className="font-mono text-xs font-black text-[#FF3800] tracking-wider uppercase">
                        🔒 Play locked // card required
                      </div>
                      <div className="font-mono text-[9.5px] text-white/65 mt-1 uppercase">
                        Own this card to play — find it in packs or the vault
                      </div>
                    </div>
                  ) : selected && (() => {
                    const shards = getShardsForDay(fragments, selected.day);
                    const unlocked = isAwardPlayUnlocked(fragments, selected.day);
                    return (
                      <div className={`hw-well p-4 text-center mb-4 ${unlocked ? 'border-[#FFB800]/45' : ''}`}>
                        <div className={`font-mono text-xs font-black tracking-wider uppercase ${unlocked ? 'text-[#FFB800]' : 'text-white/75'}`}>
                          {unlocked ? '🏆 Award play unlocked' : `◈ ${shards} / ${AWARD_PLAY_SHARD_THRESHOLD} shards`}
                        </div>
                        {!unlocked && (
                          <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden mt-2 mb-1 border border-white/10">
                            <div className="h-full bg-gradient-to-r from-[#FFB800] to-[#FF3800] rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (shards / AWARD_PLAY_SHARD_THRESHOLD) * 100)}%` }} />
                          </div>
                        )}
                        <div className="font-mono text-[9.5px] text-white/60 mt-1 uppercase">
                          {unlocked
                            ? 'High scores earn prize packs'
                            : 'Pull this card to unlock award play prizes'}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      data-testid="button-play"
                      disabled={!selectedUnlocked}
                      onClick={() => handlePlaySong()}
                      onMouseEnter={() => { if (selectedUnlocked) audioManager.playSfx('tap_nav', 0.08); }}
                      className="btn-3d flex-1 justify-center font-mono tracking-[0.22em] uppercase"
                      data-tone={selectedUnlocked ? 'acid' : 'quiet'}
                      data-size="lg"
                    >
                      <Play size={18} fill="currentColor" />
                      <span>START TRANSMISSION</span>
                    </button>

                    {selectedUnlocked && selected && ownsCardForDay(collection, selected.day) && (() => {
                      const deluxeOpen = isDeluxeUnlocked(collection, selected.day);
                      return (
                        <button
                          data-testid="button-play-deluxe"
                          disabled={!deluxeOpen}
                          onClick={() => handlePlaySong(undefined, true)}
                          title={deluxeOpen ? 'Play the Deluxe chart' : `Hit ${DELUXE_UNLOCK_ACCURACY}% on this song or open a Deluxe pack`}
                          className="btn-3d justify-center font-mono tracking-[0.18em] uppercase"
                          data-tone={deluxeOpen ? 'gold' : 'quiet'}
                          data-size="lg"
                        >
                          {deluxeOpen ? <Play size={18} fill="currentColor" /> : <Lock size={16} />}
                          <span>{deluxeOpen ? 'DELUXE' : `DELUXE · ${DELUXE_UNLOCK_ACCURACY}%`}</span>
                        </button>
                      );
                    })()}

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
                        className="btn-3d justify-center font-mono text-xs tracking-[0.16em] uppercase"
                        data-tone="default"
                        data-size="lg"
                      >
                        <Film size={18} />
                        <span className="hidden sm:inline">EXPORT PERFECT VIDEO</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-24 opacity-40">
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
