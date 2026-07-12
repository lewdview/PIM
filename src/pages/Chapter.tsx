import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { loadCatalog, isSongTimeLocked, getModifierForSong } from "@/game/api";
import type { GameSong } from "@/game/api";
import { getMedalForSong, getChapterPlatinums, getHighScore, getScoreHistory } from "@/game/progress";
import { CHAPTERS, calculateCampaignDifficulty } from "@/game/campaign";
import { getActiveTheme } from "@/lib/options";
import { audioManager } from "@/game/audio";
import { useVaultStore } from "@/store/useVaultStore";
import { purchasePack } from "@/services/vaultService";
import { PACK_CONFIGS } from "@/utils/rarity";
import { Lock, Play } from "lucide-react";


const MEDAL_COLOR: Record<string, string> = {
  PLATINUM: '#39FF14', GOLD: '#E5B800', SILVER: '#A0AABB', BRONZE: '#C97A3A', NONE: '#333', '': '#1a1a1a',
};


export default function Chapter() {
  const { month } = useParams<{ month: string }>();
  const [, setLocation] = useLocation();
  const [songs, setSongs] = useState<GameSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  // Audio preview state
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewProg, setPreviewProg] = useState(0);

  const monthNum = parseInt(month ?? '1', 10);
  const meta     = CHAPTERS.find(c => c.month === monthNum) ?? CHAPTERS[0];
  const prev     = CHAPTERS.find(c => c.month === monthNum - 1);
  const next     = CHAPTERS.find(c => c.month === monthNum + 1);

  const isAvant = getActiveTheme() === 'avant-garde';

  // Vault integration
  const collection = useVaultStore((s) => s.collection);
  const fragments = useVaultStore((s) => s.fragments);
  const loadVaultData = useVaultStore((s) => s.loadVaultData);
  const equippedCardId = useVaultStore((s) => s.equippedCardId);
  const setEquippedCardId = useVaultStore((s) => s.setEquippedCardId);
  const milestoneClaims = useVaultStore((s) => s.milestoneClaims);
  const claimedRewards = useVaultStore((s) => s.claimedRewards);

  // Milestone claimed states tracked in localStorage to persist
  const [claimedM1, setClaimedM1] = useState(false);
  const [claimedM2, setClaimedM2] = useState(false);
  const [claimedM3, setClaimedM3] = useState(false);

  useEffect(() => {
    // Proactively load vault data
    loadVaultData().catch(err => console.warn("Failed to load vault data", err));
  }, [loadVaultData]);

  useEffect(() => {
    // Load local storage or Zustand store claim states
    const c1 = milestoneClaims[`campaign_claimed_${monthNum}_1`] || localStorage.getItem(`campaign_claimed_${monthNum}_1`) === 'true';
    const c2 = milestoneClaims[`campaign_claimed_${monthNum}_2`] || localStorage.getItem(`campaign_claimed_${monthNum}_2`) === 'true';
    const c3 = milestoneClaims[`campaign_claimed_${monthNum}_3`] || localStorage.getItem(`campaign_claimed_${monthNum}_3`) === 'true';
    setClaimedM1(c1);
    setClaimedM2(c2);
    setClaimedM3(c3);
  }, [monthNum, milestoneClaims]);

  useEffect(() => {
    loadCatalog().then(catalog => {
      const filtered = catalog
        .filter(s => s.date && parseInt(s.date.split('-')[1], 10) === monthNum)
        .sort((a, b) => a.day - b.day);
      setSongs(filtered);
      setLoading(false);

      // Stop any existing preview on song list change
      cleanupPreview();
      setPreviewing(false);
      setPreviewProg(0);

      // Check if we have a last played stage to restore focus
      const lastSongId = sessionStorage.getItem("campaign_last_song_id");
      if (lastSongId) {
        const idx = filtered.findIndex(s => s.id === lastSongId);
        if (idx !== -1) {
          setSelectedIdx(idx);
          return;
        }
      }

      // Otherwise, default select to player's active level (first uncleared unlocked level)
      const regularSongsList = filtered.length > 5 ? filtered.slice(0, -5) : filtered;
      const bonusSongsList = filtered.length > 5 ? filtered.slice(-5) : [];
      const plats = getChapterPlatinums(regularSongsList.map(s => s.id));
      const bUnlocked = filtered.length > 5 ? (plats >= meta.platNeeded) : true;
      
      const hasClearedLocal = (song?: GameSong) => {
        if (!song) return false;
        const medalVal = getMedalForSong(song.id);
        const scoreVal = getHighScore(song.id);
        return (medalVal && medalVal !== '') || scoreVal > 0;
      };

      const isUnlockedLocal = (idx: number) => {
        if (idx < 0) return false;
        if (idx < regularSongsList.length) {
          if (idx === 0) return true;
          return hasClearedLocal(regularSongsList[idx - 1]);
        } else {
          if (!bUnlocked) return false;
          const bonusIdx = idx - regularSongsList.length;
          if (bonusIdx === 0) return true;
          return hasClearedLocal(bonusSongsList[bonusIdx - 1]);
        }
      };

      const defaultIdx = filtered.findIndex((s, idx) => isUnlockedLocal(idx) && !hasClearedLocal(s));
      setSelectedIdx(defaultIdx !== -1 ? defaultIdx : 0);
    });
  }, [monthNum]);

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
  };

  // Clean up preview audio on unmount
  useEffect(() => {
    return () => {
      cleanupPreview();
      previewRef.current = null;
    };
  }, []);

  // Parallax scrolling states
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const PAGE_SIZE = 5;

  const scrollToPage = (pageIdx: number) => {
    const el = containerRef.current;
    if (el && containerHeight) {
      el.scrollTo({
        top: pageIdx * containerHeight,
        behavior: 'smooth'
      });
    }
  };

  // Bind scroll and resize listeners
  useEffect(() => {
    if (loading) return;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      setScrollTop(target.scrollTop);
      const pageIdx = Math.round(target.scrollTop / (containerHeight || 800));
      setCurrentPageIdx(pageIdx);
    };

    const handleResize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
      setContainerHeight(el.clientHeight);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      if (el) el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [loading, containerHeight]);

  // Sync scroll position with selected song index
  useEffect(() => {
    if (!loading && songs.length > 0) {
      const pageIdx = Math.floor(selectedIdx / PAGE_SIZE);
      if (pageIdx !== currentPageIdx) {
        const t0 = setTimeout(() => {
          scrollToPage(pageIdx);
        }, 50);
        return () => clearTimeout(t0);
      }
    }
  }, [loading, songs.length, selectedIdx]);

  // Sync active selection when scrolling manually
  useEffect(() => {
    if (songs.length === 0) return;
    const currentSongPage = Math.floor(selectedIdx / PAGE_SIZE);
    if (currentSongPage !== currentPageIdx) {
      const newIdx = currentPageIdx * PAGE_SIZE;
      if (newIdx < songs.length) {
        setSelectedIdx(newIdx);
      }
    }
  }, [currentPageIdx, songs.length, selectedIdx]);

  const getLocalNodeCoords = (localIdx: number) => {
    const xMap = [25, 65, 30, 70, 50];
    const yMap = [15, 32, 50, 68, 85];
    return { x: xMap[localIdx], y: yMap[localIdx] };
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isAvant ? '#050505' : '#080808' }}>
        <div className="font-mono text-xs tracking-widest animate-pulse" style={{ color: isAvant ? '#39FF14' : 'rgba(255,255,255,0.3)' }}>LOADING SIGNAL DATA...</div>
      </div>
    );
  }

  const regularSongs  = songs.length > 5 ? songs.slice(0, -5) : songs;
  const bonusSongs    = songs.length > 5 ? songs.slice(-5) : [];
  const platinums     = getChapterPlatinums(regularSongs.map(s => s.id));
  const bonusUnlocked = songs.length > 5 ? (platinums >= meta.platNeeded) : true;

  // Clear tracking
  const hasCleared = (song?: GameSong) => {
    if (!song) return false;
    const medal = getMedalForSong(song.id);
    const score = getHighScore(song.id);
    return (medal && medal !== '') || score > 0;
  };

  const clearsCount = regularSongs.filter(s => hasCleared(s)).length;

  // Winding level map progression locks
  const isUnlocked = (idx: number) => {
    if (idx < 0) return false;
    if (idx < regularSongs.length) {
      if (idx === 0) return true;
      return hasCleared(regularSongs[idx - 1]);
    } else {
      if (!bonusUnlocked) return false;
      const bonusIdx = idx - regularSongs.length;
      if (bonusIdx === 0) return true;
      return hasCleared(bonusSongs[bonusIdx - 1]);
    }
  };

  // Node position helper along vertical sine wave
  const getNodeCoords = (idx: number) => {
    const x = 50 + Math.sin(idx * 0.95) * 28;
    const y = idx * 130 + 80;
    return { x, y };
  };

  // Default select to player's active level (first uncleared unlocked level)
  const defaultIdx = songs.findIndex((s, idx) => isUnlocked(idx) && !hasCleared(s));
  const activeIdx = selectedIdx < songs.length ? selectedIdx : (defaultIdx !== -1 ? defaultIdx : 0);

  const selectedSong = songs[activeIdx];

  // Selected song stats & locks
  const medal = selectedSong ? getMedalForSong(selectedSong.id) : '';
  const mc = MEDAL_COLOR[medal] ?? '#1a1a1a';
  const score = selectedSong ? getHighScore(selectedSong.id) : 0;
  const history = selectedSong ? getScoreHistory(selectedSong.id) : [];
  const modifierType = selectedSong ? getModifierForSong(selectedSong) : 'none';

  // Card ownership
  const ownsCard = selectedSong && Array.isArray(collection) ? collection.some(c => c && (c.cardId === selectedSong.id || c.card?.day === selectedSong.day)) : false;
  const isCleared = selectedSong ? hasCleared(selectedSong) : false;
  const isAllPrizesClaimed = selectedSong ? (claimedRewards[selectedSong.id]?.includes('prophecy') || localStorage.getItem(`reward_tier_${selectedSong.id}`) === 'prophecy') : false;

  const fragmentCount = selectedSong ? (fragments[selectedSong.id] ?? 0) : 0;
  const isCardUnlocked = ownsCard || fragmentCount >= 10;

  // Check locks
  const isTimeLocked = selectedSong ? isSongTimeLocked(selectedSong) : false;
  const isBonusLocked = selectedSong && (songs.indexOf(selectedSong) >= regularSongs.length) && !bonusUnlocked;
  const isProgLocked = selectedSong && !isUnlocked(songs.indexOf(selectedSong));
  
  // A song is locked if it is a replay (already cleared) AND they have less than 10 fragments AND they do NOT own the card
  const isUnlockReqLocked = isCleared ? (!ownsCard && fragmentCount < 10) : false;
  const isPlayLocked = isTimeLocked || isBonusLocked || isProgLocked || isUnlockReqLocked;

  const difficultyLevel = selectedSong
    ? calculateCampaignDifficulty(
        monthNum,
        songs.indexOf(selectedSong) >= regularSongs.length ? songs.indexOf(selectedSong) - regularSongs.length : songs.indexOf(selectedSong),
        songs.indexOf(selectedSong) >= regularSongs.length ? bonusSongs.length : regularSongs.length,
        songs.indexOf(selectedSong) >= regularSongs.length
      )
    : 5;

  const togglePreview = () => {
    if (!selectedSong) return;
    if (isAvant) audioManager.playSfx('tap_nav', 0.12);
    
    if (previewing && previewRef.current) {
      previewRef.current.pause();
      setPreviewing(false);
      return;
    }

    cleanupPreview();

    const audio = new Audio(selectedSong.audioUrl);
    audio.volume = 0.4;
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    previewRef.current = audio;

    if (audio.currentTime < 1) {
      audio.currentTime = (selectedSong.duration * 0.15); // skip to middle
    }

    audio.play().catch(() => {});
    setPreviewing(true);
  };

  const handlePlay = () => {
    if (isPlayLocked || !selectedSong) return;
    cleanupPreview();
    setPreviewing(false);
    
    audioManager.playSfx('tap_nav', 0.4);
    sessionStorage.setItem(`campaign_last_song_id`, selectedSong.id);
    sessionStorage.setItem(`game_origin_${selectedSong.id}`, `chapter/${monthNum}`);
    sessionStorage.setItem(`diff_override_${selectedSong.id}`, String(difficultyLevel));

    // Inject active card modifier if equipped
    const isEquipped = equippedCardId === selectedSong.id;
    if (isEquipped && modifierType !== 'none') {
      sessionStorage.setItem(`active_modifier_type_${selectedSong.id}`, modifierType);
    } else {
      sessionStorage.removeItem(`active_modifier_type_${selectedSong.id}`);
    }

    setLocation(`/play/${selectedSong.id}`);
  };

  // Claim milestones rewards function
  const claimReward = async (milestoneNum: number) => {
    if (milestoneNum === 1 && clearsCount < 5) return;
    if (milestoneNum === 2 && clearsCount < 15) return;
    if (milestoneNum === 3 && clearsCount < regularSongs.length) return;

    const claimKey = `campaign_claimed_${monthNum}_${milestoneNum}`;
    if (localStorage.getItem(claimKey) === 'true') return;

    let category: 'taste' | 'light' | 'dark' = 'taste';
    if (milestoneNum === 2) {
      category = meta.mood === 'light' ? 'light' : 'dark';
    } else if (milestoneNum === 3) {
      category = meta.mood === 'light' ? 'dark' : 'light';
    }

    if (isAvant) {
      audioManager.playSfx('tap_nav', 0.2);
    }

    const cards = await purchasePack(category, 'single', undefined, undefined, true);
    if (cards && cards.length > 0) {
      localStorage.setItem(claimKey, 'true');
      useVaultStore.getState().syncMilestoneClaim(monthNum, milestoneNum);
      
      // Update claimed state UI
      if (milestoneNum === 1) setClaimedM1(true);
      if (milestoneNum === 2) setClaimedM2(true);
      if (milestoneNum === 3) setClaimedM3(true);

      // Add to store collection and start reveal
      useVaultStore.getState().addToCollection(cards);
      
      const config = PACK_CONFIGS[category];
      const packMeta = {
        category,
        size: 'single',
        label: `MILESTONE REWARD: ${config.label}`,
        icon: config.icon,
        accent: config.accent,
        gradient: config.gradient,
        price: 'REWARD',
        cardCount: cards.length,
        revealType: 'cinematic' as const,
        redirectPath: `/chapter/${monthNum}`,
        showRipAnother: false,
      };

      useVaultStore.getState().startReveal(cards, packMeta);
      setLocation('/vault/reveal');
    }
  };

  // Split songs into pages of size 5
  const pagesCount = Math.ceil(songs.length / PAGE_SIZE);
  const songPages = Array.from({ length: pagesCount }, (_, pageIdx) => {
    return songs.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);
  });

  const getPageTitle = (pageIdx: number) => {
    const firstSongIdx = pageIdx * PAGE_SIZE;
    if (firstSongIdx >= regularSongs.length) {
      return "BONUS SECTOR";
    }
    const start = firstSongIdx + 1;
    const end = Math.min(regularSongs.length, (pageIdx + 1) * PAGE_SIZE);
    return `STAGES ${String(start).padStart(2, '0')}-${String(end).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-dvh w-full flex flex-col overflow-hidden select-none"
      style={{
        background: isAvant ? '#050505' : '#080808',
        position: 'relative'
      }}>
      
      {/* Sticky top nav */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{
          background: isAvant ? 'rgba(5,5,5,0.95)' : 'rgba(8,8,12,0.85)',
          borderBottom: isAvant ? '1px solid rgba(57,255,20,0.2)' : '2px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)'
        }}>
        <button onClick={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.12); setLocation('/campaign'); }}
          className="font-mono text-xs tracking-widest transition-all"
          style={isAvant ? {
            color: '#39FF14',
            border: '1px solid rgba(57,255,20,0.3)',
            padding: '4px 10px',
            background: 'none',
            cursor: 'pointer'
          } : {
            color: 'rgba(255,255,255,0.35)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '4px 10px',
            boxShadow: '2px 2px 0 rgba(255,255,255,0.06)',
            background: 'none',
            cursor: 'pointer'
          }}
          onMouseEnter={e => {
            if (isAvant) {
              audioManager.playSfx('tap_nav', 0.08);
              return;
            }
            const el = e.currentTarget as HTMLElement;
            el.style.color = meta.dc;
            el.style.borderColor = meta.dc;
            el.style.boxShadow = `2px 2px 0 ${meta.dc}`;
          }}
          onMouseLeave={e => {
            if (isAvant) return;
            const el = e.currentTarget as HTMLElement;
            el.style.color = 'rgba(255,255,255,0.35)';
            el.style.borderColor = 'rgba(255,255,255,0.1)';
            el.style.boxShadow = '2px 2px 0 rgba(255,255,255,0.06)';
          }}>
          ← CAMPAIGN MAP
        </button>
        
        <div className="font-mono font-bold text-xs tracking-[0.6em] text-center" style={{ color: isAvant ? '#39FF14' : 'rgba(255,255,255,0.25)' }}>
          CH {String(meta.month).padStart(2, '0')} // {meta.name.toUpperCase()}
        </div>
        
        <div className="flex gap-2">
          {prev && <button onClick={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.12); setLocation(`/chapter/${prev.month}`); }} className="font-mono text-xs px-3 py-1 cursor-pointer" style={{ color: isAvant ? '#39FF14' : 'rgba(255,255,255,0.25)', border: isAvant ? '1px solid rgba(57,255,20,0.3)' : '1px solid rgba(255,255,255,0.08)', background: 'none' }} onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.08); }} >‹</button>}
          {next && <button onClick={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.12); setLocation(`/chapter/${next.month}`); }} className="font-mono text-xs px-3 py-1 cursor-pointer" style={{ color: isAvant ? '#39FF14' : 'rgba(255,255,255,0.25)', border: isAvant ? '1px solid rgba(57,255,20,0.3)' : '1px solid rgba(255,255,255,0.08)', background: 'none' }} onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.08); }} >›</button>}
        </div>
      </div>

      {/* Main Parallax Scrolling Container */}
      <div className="flex-1 w-full overflow-hidden relative">

        {/* Right Floating Dot Bullet Navigation */}
        {pagesCount > 1 && (
          <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-30 animate-fade-in">
            {songPages.map((_, pIdx) => {
              const active = currentPageIdx === pIdx;
              return (
                <button
                  key={pIdx}
                  onClick={() => scrollToPage(pIdx)}
                  className="w-3.5 h-3.5 rounded-full border transition-all relative flex items-center justify-center cursor-pointer"
                  style={{
                    borderColor: active ? meta.dc : 'rgba(255,255,255,0.15)',
                    backgroundColor: active ? meta.dc : 'transparent',
                    boxShadow: active ? `0 0 10px ${meta.dc}60` : 'none'
                  }}
                  title={getPageTitle(pIdx)}
                >
                  {active && (
                    <span 
                      className="absolute -inset-1 rounded-full border animate-ping opacity-35"
                      style={{ borderColor: meta.dc }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Scrolling Viewport */}
        <div
          ref={containerRef}
          id="stages-scroll-container"
          className="w-full h-[calc(100vh-60px)] overflow-y-auto snap-y snap-mandatory scroll-smooth relative z-10 scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {songs.length === 0 ? (
            <div className="h-full flex items-center justify-center font-mono text-xs text-white/20">
              NO SECTOR STAGES FOUND
            </div>
          ) : (
            songPages.map((pageSongs, pIdx) => {
              const sectionTop = pIdx * containerHeight;
              const relativeScroll = scrollTop - sectionTop;

              // Parallax translations
              const titleY = relativeScroll * 0.45;
              const ringY  = relativeScroll * 0.25;
              const gridY  = relativeScroll * 0.12;

              const pageTitleText = getPageTitle(pIdx);

              return (
                <section
                  key={pIdx}
                  className="w-full h-full snap-start relative flex items-center justify-center overflow-hidden border-b border-white/5"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, ${meta.dc}08 0%, #080808 100%)`
                  }}
                >
                  {/* 1. Background Giant Text Layer */}
                  <div
                    className="absolute font-mono font-black select-none pointer-events-none text-[16vw] tracking-wider leading-none text-center"
                    style={{
                      transform: `translateY(${titleY}px)`,
                      color: `${meta.dc}05`,
                      WebkitTextStroke: `1px ${meta.dc}15`,
                    }}
                  >
                    {pageTitleText.replace('STAGES ', '')}
                  </div>

                  {/* 1.5 Background Album Art Collage Layer */}
                  <div 
                    className="absolute inset-0 pointer-events-none z-0 opacity-[0.03] overflow-hidden flex items-center justify-center scale-125"
                    style={{
                      transform: `translateY(${gridY}px)`
                    }}
                  >
                    <div className="grid grid-cols-3 gap-6 w-full h-full p-12 -rotate-12">
                      {Array.from({ length: 9 }).map((_, rIdx) => {
                        const song = pageSongs[rIdx % pageSongs.length];
                        return song && song.coverArt ? (
                          <div key={rIdx} className="aspect-square w-full overflow-hidden rounded bg-zinc-900 border border-white/5 shadow-2xl">
                            <img 
                              src={song.coverArt} 
                              alt={song.title} 
                              className="w-full h-full object-cover filter grayscale contrast-125 brightness-50"
                            />
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>

                  {/* 2. Glowing Radial Light Layer */}
                  <div
                    className="absolute w-[500px] h-[500px] rounded-full blur-[100px] pointer-events-none opacity-10"
                    style={{
                      background: `radial-gradient(circle, ${meta.dc} 0%, transparent 70%)`,
                      transform: `translateY(${ringY}px)`,
                    }}
                  />

                  {/* 3. Tech Grid Background Layer */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: isAvant
                        ? "linear-gradient(rgba(57,255,20,0.01) 1px,transparent 1px),linear-gradient(90deg,rgba(57,255,20,0.01) 1px,transparent 1px)"
                        : "linear-gradient(rgba(255,255,255,0.005) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.005) 1px,transparent 1px)",
                      backgroundSize: "48px 48px",
                      transform: `translateY(${gridY}px)`,
                    }}
                  />

                  {/* 4. Split Console Interaction Card */}
                  <div 
                    className="relative z-10 w-full max-w-5xl mx-4 p-5 sm:p-6 border rounded-2xl backdrop-blur-xl bg-black/85 flex flex-col lg:flex-row gap-6 shadow-2xl transition-all duration-300 min-h-[480px] lg:h-[75vh]"
                    style={{
                      borderColor: `${meta.dc}33`,
                      boxShadow: `0 0 30px ${meta.dc}10`
                    }}
                  >
                    
                    {/* LEFT PANEL: Winding Road Constellation Map */}
                    <div className="flex-1 flex flex-col justify-between relative min-h-[300px] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-white/5 pb-6 lg:pb-0 lg:pr-6">
                      
                      {/* Top coordinates label */}
                      <div className="font-mono text-[8px] text-zinc-500 uppercase tracking-widest flex justify-between select-none">
                        <span>STAGE_CONSTELLATION // DECODING_PATH</span>
                        <span style={{ color: meta.dc }}>CH_{String(meta.month).padStart(2, '0')} // PAGE_{pIdx + 1}</span>
                      </div>

                      {/* SVG Level Road */}
                      <div className="flex-1 relative w-full h-full min-h-[260px]">
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          
                          {/* Connection Lines */}
                          {pageSongs.map((_, localIdx) => {
                            if (localIdx === pageSongs.length - 1) return null;
                            const globalIdxA = pIdx * PAGE_SIZE + localIdx;
                            const globalIdxB = globalIdxA + 1;
                            
                            const p1 = getLocalNodeCoords(localIdx);
                            const p2 = getLocalNodeCoords(localIdx + 1);
                            
                            const unlA = isUnlocked(globalIdxA);
                            const unlB = isUnlocked(globalIdxB);
                            const clA = hasCleared(songs[globalIdxA]);
                            
                            let strokeColor = 'rgba(255,255,255,0.06)';
                            let strokeDash = '';
                            if (isAvant) {
                              if (clA && unlB) {
                                strokeColor = '#39FF14';
                              } else if (unlA && !clA) {
                                strokeColor = 'rgba(57,255,20,0.4)';
                                strokeDash = '3 3';
                              } else {
                                strokeColor = 'rgba(57,255,20,0.1)';
                              }
                            } else {
                              if (clA && unlB) {
                                strokeColor = meta.dc;
                              } else if (unlA && !clA) {
                                strokeColor = `${meta.dc}70`;
                                strokeDash = '3 3';
                              }
                            }
                            
                            return (
                              <line
                                key={localIdx}
                                x1={p1.x}
                                y1={p1.y}
                                x2={p2.x}
                                y2={p2.y}
                                stroke={strokeColor}
                                strokeWidth={isAvant ? 1.0 : 2.5}
                                strokeDasharray={strokeDash}
                              />
                            );
                          })}
                        </svg>

                        {/* Interactive Buttons */}
                        {pageSongs.map((song, localIdx) => {
                          const globalIdx = pIdx * PAGE_SIZE + localIdx;
                          const coords = getLocalNodeCoords(localIdx);
                          const unl = isUnlocked(globalIdx);
                          const cl = hasCleared(song);
                          const nodeMedal = getMedalForSong(song.id);
                          const isSel = selectedIdx === globalIdx;
                          const isBonus = globalIdx >= regularSongs.length;
                          const nodeAllClaimed = claimedRewards[song.id]?.includes('prophecy') || localStorage.getItem(`reward_tier_${song.id}`) === 'prophecy';
                          
                          const nColor = MEDAL_COLOR[nodeMedal] ?? '#1a1a1a';
                          
                          let borderStyle = {};
                          let bgStyle = {};
                          let outerRing = null;
                          
                          if (isAvant) {
                            borderStyle = {
                              borderColor: isSel ? '#39FF14' : cl ? nColor : unl ? 'rgba(57,255,20,0.6)' : 'rgba(57,255,20,0.15)',
                              boxShadow: isSel ? '0 0 12px #39FF14' : 'none',
                            };
                            bgStyle = {
                              background: isSel ? '#39FF1420' : cl ? `${nColor}25` : '#050505',
                              color: isSel ? '#39FF14' : unl ? '#fff' : 'rgba(255,255,255,0.2)',
                            };
                          } else {
                            borderStyle = {
                              borderColor: isSel ? '#fff' : cl ? nColor : unl ? meta.dc : 'rgba(255,255,255,0.06)',
                              boxShadow: isSel ? `0 0 16px ${meta.dc}` : cl ? `0 0 8px ${nColor}30` : 'none',
                            };
                            bgStyle = {
                              background: isSel ? meta.dc : cl ? '#121212' : 'rgba(255,255,255,0.02)',
                              color: isSel ? '#000' : unl ? '#fff' : 'rgba(255,255,255,0.2)',
                            };
                            
                            if (unl && !cl && !isSel) {
                              outerRing = (
                                <div className="absolute inset-[-5px] rounded-full border border-dashed animate-spin" style={{ borderColor: `${meta.dc}50`, animationDuration: '6s' }} />
                              );
                            }
                          }

                          return (
                            <button
                              key={song.id}
                              onClick={() => {
                                audioManager.playSfx('tap_nav', 0.08);
                                setSelectedIdx(globalIdx);
                              }}
                              className="absolute flex items-center justify-center transition-all duration-200 cursor-pointer"
                              style={{
                                left: `${coords.x}%`,
                                top: `${coords.y}%`,
                                transform: 'translate(-50%, -50%)',
                                width: 44,
                                height: 44,
                                borderRadius: isAvant ? '0px' : '50%',
                                borderWidth: isSel ? 3 : 2,
                                borderStyle: 'solid',
                                zIndex: 10,
                                ...borderStyle,
                                ...bgStyle,
                                opacity: unl ? 1 : 0.45,
                              }}
                              disabled={!unl}
                            >
                              {outerRing}
                              <span className="font-mono font-bold text-xs">
                                {String(globalIdx + 1).padStart(2, '0')}
                              </span>
                              
                              {!unl && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full font-mono text-[10px] text-white/50">
                                  🔒
                                </div>
                              )}
                              
                              {isBonus && unl && (
                                <div className="absolute -top-1.5 -right-1.5 text-xs text-[#E5B800]" title="Bonus Stage">
                                  ★
                                </div>
                              )}
                              
                              {nodeAllClaimed && unl && (
                                <div className="absolute -bottom-1 -right-1.5 text-xs" title="All Prizes Claimed">
                                  🏆
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Bottom milestones summary */}
                      <div className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest pt-2 flex justify-between select-none">
                        <span>DECODED: {clearsCount}/{regularSongs.length} TRACKS</span>
                        <span>BONUS SHIELD: {bonusUnlocked ? "UNLOCKED" : `LOCKED (✦ ${platinums}/${meta.platNeeded} PT)`}</span>
                      </div>
                    </div>

                    {/* RIGHT PANEL: Song Detail drawer console */}
                    {/* Always rendered in card on desktop; hidden on mobile in favor of floating bar */}
                    <div className="hidden lg:flex w-full lg:w-[380px] flex-shrink-0 flex-col justify-between overflow-y-auto scrollbar-none">
                      
                      {/* Sub-container */}
                      <div className="space-y-4">
                        
                        {/* Milestone progress drawer header */}
                        <div className="border border-white/5 bg-zinc-950/40 p-3 rounded-lg space-y-2 text-left">
                          <div className="flex justify-between items-baseline">
                            <span className="font-mono text-[8px] text-zinc-500 font-bold uppercase tracking-wider">// chapter rewards</span>
                            <span className="font-mono text-[9px] font-black" style={{ color: meta.dc }}>
                              {clearsCount} / {regularSongs.length} CLEARS
                            </span>
                          </div>
                          
                          {/* Mini progressive meters */}
                          <div className="flex gap-1.5 justify-between">
                            <button
                              onClick={() => clearsCount >= 5 && !claimedM1 && claimReward(1)}
                              disabled={clearsCount < 5 || claimedM1}
                              className={`flex-1 py-1.5 text-[7px] font-mono font-black border text-center transition-all ${
                                claimedM1 
                                  ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400 cursor-default'
                                  : clearsCount >= 5
                                    ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300 hover:scale-105 cursor-pointer'
                                    : 'border-white/5 bg-transparent text-zinc-600 cursor-not-allowed'
                              }`}
                            >
                              {claimedM1 ? "TASTE ✓" : clearsCount >= 5 ? "CLAIM TASTE" : "TASTE (5)"}
                            </button>
                            <button
                              onClick={() => clearsCount >= 15 && !claimedM2 && claimReward(2)}
                              disabled={clearsCount < 15 || claimedM2}
                              className={`flex-1 py-1.5 text-[7px] font-mono font-black border text-center transition-all ${
                                claimedM2 
                                  ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400 cursor-default'
                                  : clearsCount >= 15
                                    ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300 hover:scale-105 cursor-pointer'
                                    : 'border-white/5 bg-transparent text-zinc-600 cursor-not-allowed'
                              }`}
                            >
                              {claimedM2 ? `${meta.mood.toUpperCase()} ✓` : clearsCount >= 15 ? `CLAIM ${meta.mood.toUpperCase()}` : `${meta.mood.toUpperCase()} (15)`}
                            </button>
                            <button
                              onClick={() => clearsCount >= regularSongs.length && !claimedM3 && claimReward(3)}
                              disabled={clearsCount < regularSongs.length || claimedM3}
                              className={`flex-1 py-1.5 text-[7px] font-mono font-black border text-center transition-all ${
                                claimedM3 
                                  ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400 cursor-default'
                                  : clearsCount >= regularSongs.length
                                    ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300 hover:scale-105 cursor-pointer'
                                    : 'border-white/5 bg-transparent text-zinc-600 cursor-not-allowed'
                              }`}
                            >
                              {claimedM3 ? `${meta.mood === 'light' ? 'DARK' : 'LIGHT'} ✓` : clearsCount >= regularSongs.length ? `CLAIM FINAL` : `FINAL (${regularSongs.length})`}
                            </button>
                          </div>
                        </div>

                        {/* Song Details section */}
                        {selectedSong ? (
                          <div className="space-y-4.5 text-left">
                            
                            {/* Title block with cover art */}
                            <div className="flex gap-4 items-start">
                              <div className="relative flex-shrink-0">
                                {selectedSong.coverArt ? (
                                  <img src={selectedSong.coverArt} alt={selectedSong.title}
                                    className="object-cover rounded w-16 h-16 border border-white/10"
                                    style={{ filter: isPlayLocked ? 'grayscale(100%) brightness(0.3)' : 'none' }} />
                                ) : (
                                  <div className="flex items-center justify-center font-mono font-bold text-lg rounded bg-white/5 border border-white/10 w-16 h-16 text-white/20">
                                    {selectedSong.day}
                                  </div>
                                )}
                                {isUnlocked(songs.indexOf(selectedSong)) && (
                                  <button onClick={togglePreview}
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 transition-colors rounded cursor-pointer">
                                    <span className="text-white text-md font-bold">{previewing ? '❚❚' : '▶'}</span>
                                  </button>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 flex-wrap mb-1">
                                  <span className="font-mono text-[7px] px-1.5 py-0.5 border rounded uppercase font-black"
                                    style={{
                                      borderColor: selectedSong.mood === 'light' ? '#39FF14' : '#FF1493',
                                      color: selectedSong.mood === 'light' ? '#39FF14' : '#FF1493',
                                      background: selectedSong.mood === 'light' ? '#39FF1410' : '#FF149310'
                                    }}>
                                    {selectedSong.mood}
                                  </span>
                                  {medal && (
                                    <span className="font-mono text-[7px] px-1.5 py-0.5 border rounded uppercase font-black"
                                      style={{ borderColor: mc, color: mc, background: `${mc}10` }}>
                                      {medal}
                                    </span>
                                  )}
                                  {isAllPrizesClaimed && (
                                    <span className="font-mono text-[7px] px-1.5 py-0.5 border border-yellow-400 text-yellow-400 bg-yellow-400/10 rounded uppercase font-black">
                                      🏆 ALL PRIZES
                                    </span>
                                  )}
                                  {ownsCard && (
                                    <span className="font-mono text-[7px] px-1.5 py-0.5 border border-yellow-500/40 text-yellow-500 bg-yellow-500/10 rounded uppercase font-black">
                                      OWNED
                                    </span>
                                  )}
                                </div>

                                <h2 className="font-mono font-bold text-sm text-[#F2F0E8] truncate uppercase">
                                  {selectedSong.title}
                                </h2>
                                <div className="font-mono text-[9px] text-white/50 truncate uppercase">
                                  BY {selectedSong.artist}
                                </div>
                                <div className="font-mono text-[7px] text-white/30 uppercase mt-0.5">
                                  STAGE {songs.indexOf(selectedSong) + 1} // BPM: {selectedSong.bpm} // LVL: {difficultyLevel}
                                </div>
                              </div>
                            </div>

                            {/* Waveform preview player bar */}
                            {previewing && (
                              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${previewProg * 100}%` }} />
                              </div>
                            )}

                            {/* Score info */}
                            {score > 0 ? (
                              <div className="border border-white/5 bg-zinc-950/40 p-2 rounded flex justify-between items-center text-xs">
                                <span className="font-mono text-[8px] text-white/40">// DISPATCH HIGH SCORE:</span>
                                <span className="font-mono font-bold" style={{ color: isAvant ? '#39FF14' : meta.dc }}>
                                  {score.toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              <div className="border border-dashed border-white/5 p-2 rounded text-center text-xs">
                                <span className="font-mono text-[7px] text-white/20">// NO DISPATCH TELEMETRY ON RECORD</span>
                              </div>
                            )}

                            {/* Song description */}
                            {selectedSong.description && (
                              <p className="font-mono text-[8px] text-white/45 italic leading-relaxed bg-white/[0.005] p-2 rounded border border-white/5">
                                "{selectedSong.description.toUpperCase()}"
                              </p>
                            )}

                            {/* Modifier card link slot */}
                            {isUnlocked(songs.indexOf(selectedSong)) && ownsCard && modifierType !== 'none' && (
                              <div className="border border-[#39FF14]/25 bg-black/40 p-2 flex items-center justify-between rounded">
                                <div className="text-left pr-2">
                                  <div className="font-mono text-[7px] text-[#39FF14] font-black uppercase">
                                    // LINKED CARD MODIFIER
                                  </div>
                                  <div className="font-mono text-[8px] text-white/80 font-bold uppercase mt-0.5">
                                    {(modifierType || '').replace('_', ' ')}
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    audioManager.playSfx('tap_nav', 0.08);
                                    setEquippedCardId(equippedCardId === selectedSong.id ? null : selectedSong.id);
                                  }}
                                  className={`font-mono text-[8px] font-black px-2 py-1 border rounded uppercase transition-colors cursor-pointer ${
                                    equippedCardId === selectedSong.id
                                      ? 'border-[#39FF14] bg-[#39FF14]/20 text-[#39FF14]'
                                      : 'border-[#39FF14]/30 bg-transparent text-white/50 hover:border-[#39FF14]/50'
                                  }`}
                                >
                                  {equippedCardId === selectedSong.id ? 'ACTIVE' : 'EQUIP'}
                                </button>
                              </div>
                            )}

                            {/* Warnings overlays */}
                            <div className="space-y-1.5">
                              {isTimeLocked && (
                                <div className="p-1.5 border border-[#FF3800]/30 bg-[#FF3800]/10 text-center rounded text-[8px] font-mono text-[#FF3800]">
                                  🔒 SIGNAL DOCKED — CHRONO TIME LOCK ACTIVE
                                </div>
                              )}
                              {isBonusLocked && (
                                <div className="p-1.5 border border-[#FF3800]/30 bg-[#FF3800]/10 text-center rounded text-[8px] font-mono text-[#FF3800]">
                                  🔒 BONUS SECTOR SHIELDED — REQUIRE {meta.platNeeded} PLATINUMS (CURRENT: {platinums})
                                </div>
                              )}
                              {isProgLocked && !isTimeLocked && !isBonusLocked && (
                                <div className="p-1.5 border border-[#FF3800]/30 bg-[#FF3800]/10 text-center rounded text-[8px] font-mono text-[#FF3800]">
                                  🔒 TRANSMISSION LOCKED — CLEAR PREVIOUS LEVEL TO UNLOCK PATHWAY
                                </div>
                              )}
                              {isUnlockReqLocked && !isTimeLocked && !isBonusLocked && !isProgLocked && (
                                <div className="p-2 border border-yellow-500/20 bg-yellow-500/5 rounded space-y-1.5">
                                  <div className="flex justify-between items-baseline">
                                    <span className="font-mono text-[7px] text-yellow-500 font-bold uppercase tracking-wider">// SONG REPLAY REQUISITE</span>
                                    <span className="font-mono text-[8px] text-white/90 font-black">{fragmentCount} / 10 FRAGS</span>
                                  </div>
                                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                                    <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-300"
                                      style={{ width: `${Math.min(100, (fragmentCount / 10) * 100)}%` }} />
                                  </div>
                                  <div className="font-mono text-[7px] text-white/40 leading-normal uppercase">
                                    Unlock requires 10 fragments. Decrypt in shop or claim daily drops to unlock.
                                  </div>
                                </div>
                              )}
                            </div>

                          </div>
                        ) : (
                          <div className="h-[200px] flex items-center justify-center border border-dashed border-white/10 rounded-xl bg-black/20 font-mono text-xs text-white/20">
                            SELECT A LEVEL NODE ON THE PATHWAY
                          </div>
                        )}

                      </div>

                      {/* Play actions buttons console */}
                      {selectedSong && (
                        <div className="pt-6 flex gap-2">
                          <button onClick={handlePlay}
                            disabled={isPlayLocked}
                            className={`flex-1 py-3 text-xs tracking-[0.3em] font-black border uppercase transition-all rounded cursor-pointer ${
                              !isPlayLocked 
                                ? (isAvant ? 'border-[#39FF14] bg-[#39FF14] text-black hover:bg-[#39FF14]/90' : 'border-[#fff] bg-[#fff] text-black hover:bg-white/90')
                                : 'border-white/10 bg-white/5 text-white/20 cursor-not-allowed'
                            }`}
                            style={!isPlayLocked ? { boxShadow: `0 4px 12px ${isAvant ? '#39FF14' : meta.dc}30` } : {}}
                          >
                            {isUnlockReqLocked ? '🔒 DECODE REQUIRED' : isCleared ? 'REPLAY TRANSMISSION' : '▶ START TRANSMISSION'}
                          </button>
                          
                          {isUnlocked(songs.indexOf(selectedSong)) && (
                            <button onClick={() => setLocation(`/song/${selectedSong.id}?from=chapter/${monthNum}`)}
                              className="py-3 px-4 text-xs font-mono border border-white/10 hover:border-white/30 text-white/60 hover:text-white rounded cursor-pointer bg-transparent">
                              CODEX
                            </button>
                          )}
                        </div>
                      )}

                    </div>

                  </div>
                </section>
              );
            })
          )}
        </div>

      </div>

      {/* MOBILE FLOATING BOTTOM PLAY PANEL (only on viewport size < lg) */}
      {selectedSong && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-4 border-t"
          style={{
            borderColor: isAvant ? 'rgba(57,255,20,0.2)' : 'rgba(255,255,255,0.06)',
            background: isAvant ? 'rgba(5,5,5,0.95)' : 'rgba(8,8,12,0.9)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 -10px 30px rgba(0,0,0,0.5)',
            paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex flex-col gap-2">
            
            {/* Song title banner */}
            <div className="flex justify-between items-center font-mono text-[9px] tracking-wider mb-1 text-left">
              <div className="truncate max-w-[70%]">
                <span className="font-bold text-white uppercase block truncate">
                  {selectedSong.title}
                </span>
                <span className="text-zinc-500 text-[8px] block truncate">
                  BY {selectedSong.artist}
                </span>
              </div>
              <div className="text-right flex-shrink-0" style={{ color: selectedSong.mood === 'light' ? '#39FF14' : '#FF1493' }}>
                STAGE {songs.indexOf(selectedSong) + 1} // LVL {difficultyLevel}
              </div>
            </div>

            {/* Warnings inside overlay if locked */}
            {isPlayLocked && (
              <div className="p-1.5 border border-[#FF3800]/30 bg-[#FF3800]/10 text-center rounded text-[8px] font-mono text-[#FF3800] uppercase mb-1">
                {isTimeLocked 
                  ? '🔒 CHRONO TIME LOCK ACTIVE' 
                  : isBonusLocked 
                    ? `🔒 NEED ${meta.platNeeded} PLATINUMS (HAVE ${platinums})` 
                    : isUnlockReqLocked
                      ? `🔒 DECODE REQUIRED: ${fragmentCount}/10 FRAGMENTS`
                      : '🔒 TRANSMISSION LOCKED'}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handlePlay}
                disabled={isPlayLocked}
                className={`flex-1 py-3 text-xs tracking-[0.3em] font-black border uppercase transition-all rounded cursor-pointer ${
                  !isPlayLocked
                    ? (isAvant ? 'border-[#39FF14] bg-[#39FF14] text-black hover:bg-[#39FF14]/90' : 'border-[#fff] bg-[#fff] text-black hover:bg-white/90')
                    : 'border-white/10 bg-white/5 text-white/20 cursor-not-allowed'
                }`}
                style={!isPlayLocked ? { boxShadow: `0 4px 12px ${isAvant ? '#39FF14' : meta.dc}30` } : {}}
              >
                {isUnlockReqLocked ? '🔒 DECODE' : isCleared ? 'REPLAY' : '▶ START'}
              </button>
              
              {isUnlocked(songs.indexOf(selectedSong)) && (
                <button
                  onClick={() => setLocation(`/song/${selectedSong.id}?from=chapter/${monthNum}`)}
                  className="py-3 px-3 text-xs font-mono border border-white/10 hover:border-white/30 text-white/60 hover:text-white rounded cursor-pointer bg-transparent"
                >
                  CODEX
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

