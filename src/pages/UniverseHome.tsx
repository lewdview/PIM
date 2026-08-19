/**
 * UniverseHome.tsx — The Front Door to "365 Days of Light & Dark"
 *
 * Core Hierarchy:
 * WHO: th3scr1b3
 * WHAT: 365 DAYS OF LIGHT & DARK
 * NOW: Today's Song & Creative Artifact
 *
 * Primary CTA: PLAY TODAY'S DROP
 * Secondary: LISTEN | EXPLORE 365 | GIVE ME A SIGN
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import {
  Play, Pause, Volume2, Sparkles, Compass, Disc, Clock,
  ArrowRight, Flame, Layers, Shield, Shuffle, Zap, Gamepad2, Info, ChevronRight
} from 'lucide-react';
import { getCurrentDay, getTimeUntilNextDay, formatDate, getDateFromDay } from '../utils/dayCalc';
import { loadCatalog, type GameSong } from '../game/api';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { useVaultStore } from '../store/useVaultStore';
import { audioManager } from '../game/audio';
import { getCardByDay, type VaultCard } from '../services/vaultService';
import Card from '../components/Card';
import MainBrandLogo from '../components/MainBrandLogo';
import { RARITY_CONFIG } from '../utils/rarity';

export default function UniverseHome() {
  const [, setLocation] = useLocation();
  const today = getCurrentDay();
  const [todaySong, setTodaySong] = useState<GameSong | null>(null);
  const [todayCard, setTodayCard] = useState<VaultCard | null>(null);
  const [recentSongs, setRecentSongs] = useState<GameSong[]>([]);
  const [countdown, setCountdown] = useState(getTimeUntilNextDay());
  const [loading, setLoading] = useState(true);

  // 3D Card tilt state
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovering, setIsHovering] = useState(false);

  // Global persistent audio player
  const currentTrack = useGlobalPlayer(s => s.currentTrack);
  const isPlaying = useGlobalPlayer(s => s.isPlaying);
  const playGlobal = useGlobalPlayer(s => s.play);
  const pauseGlobal = useGlobalPlayer(s => s.pause);

  const isTodayPlaying = Boolean(
    isPlaying && currentTrack && currentTrack.day === today
  );

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => setCountdown(getTimeUntilNextDay()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load catalog and today's artifact
  useEffect(() => {
    let active = true;
    loadCatalog()
      .then(catalog => {
        if (!active) return;
        const matched = catalog.find(s => s.day === today) || catalog[catalog.length - 1];
        setTodaySong(matched);

        // Recent released days (last 6)
        const unlocked = catalog.filter(s => s.day <= today).sort((a, b) => b.day - a.day);
        setRecentSongs(unlocked.slice(0, 6));

        // Load card metadata
        getCardByDay(today).then(card => {
          if (active && card) setTodayCard(card);
        });
      })
      .catch(err => {
        console.error('Failed to load catalog for UniverseHome:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [today]);

  // Handle direct audio toggle
  const handleToggleAudio = useCallback(() => {
    if (!todaySong) return;
    if (isTodayPlaying) {
      pauseGlobal();
      audioManager.playSfx('pause', 0.3);
    } else {
      audioManager.playSfx('select_start_song', 0.4);
      playGlobal({
        title: todaySong.title,
        artist: todaySong.artist || 'th3scr1b3',
        audioUrl: todaySong.audioUrl,
        coverUrl: todaySong.coverArt || todayCard?.coverUrl || '',
        day: todaySong.day || today,
        rarity: todayCard?.rarity || 'common',
        isDailyClaim: true,
        maxDuration: 0,
      });
    }
  }, [todaySong, todayCard, isTodayPlaying, playGlobal, pauseGlobal, today]);

  // Primary Action: Play Today's Drop
  const handlePlayDrop = useCallback(() => {
    audioManager.playSfx('select_start_song', 0.5);
    localStorage.setItem('pim_tutorial_completed', 'true');
    localStorage.setItem('has_onboarded', 'true');
    useVaultStore.getState().updateProgression({ tutorialCompleted: true }).catch(() => {});
    useVaultStore.getState().completeOnboarding().catch(() => {});
    
    if (todaySong?.id) {
      setLocation(`/play/${todaySong.id}`);
    } else {
      setLocation(`/play/day-${today}`);
    }
  }, [todaySong, today, setLocation]);

  // Discovery Action: Give Me A Sign (Random Day)
  const handleGiveMeASign = useCallback(() => {
    audioManager.playSfx('open_chest', 0.6);
    const randomDay = Math.floor(Math.random() * today) + 1;
    setLocation(`/day/${randomDay}`);
  }, [today, setLocation]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  const rotateX = isHovering ? (mousePos.y - 0.5) * -16 : 0;
  const rotateY = isHovering ? (mousePos.x - 0.5) * 16 : 0;

  const todayDateStr = useMemo(() => {
    const d = getDateFromDay(today);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, [today]);

  const moodAccent = todaySong?.mood === 'light' ? '#39FF14' : '#FF1493';

  return (
    <div className="flex-1 w-full min-h-screen bg-[#050402] text-white select-none relative overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute top-[5%] left-[50%] -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-[180px] opacity-15"
          style={{ background: `radial-gradient(circle, ${moodAccent}, transparent 70%)` }}
        />
        <div
          className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] rounded-full blur-[160px] opacity-10"
          style={{ background: 'radial-gradient(circle, #E5B800, transparent 70%)' }}
        />
      </div>

      {/* Grid line texture overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none z-0" />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SECTION 1: HERO ABOVE-THE-FOLD (5-SECOND COMPREHENSION)     */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        
        {/* Top Minimalist Tag */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10 mb-8">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-ping" style={{ background: moodAccent }} />
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/60">
              ORIGINAL ARTWORK & MUSIC ARCHIVE // <strong className="text-white">TH3SCR1B3</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-white/50">
            <Clock size={12} className="text-[#E5B800]" />
            <span>DAY {today} OF 365</span>
            <span className="text-white/20">•</span>
            <span className="text-[#E5B800] font-bold">
              RESET IN {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Master Identity Display */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <MainBrandLogo size="hero" priority={true} interactive={true} />
            <h1 className="sr-only">365 Days of Light & Dark by th3scr1b3</h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="font-mono text-xs sm:text-sm tracking-[0.3em] uppercase text-white/70 mt-3"
          >
            A LIVING ARTISTIC UNIVERSE. 365 DAYS. 365 ARTIFACTS. ONE JOURNEY.
          </motion.p>
        </div>

        {/* Main Stage Grid: Today's Drop Pedestal + Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-center">
          
          {/* LEFT: 3D Today Card & Art */}
          <div
            className="relative flex flex-col items-center justify-center"
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => { setIsHovering(false); setMousePos({ x: 0.5, y: 0.5 }); }}
            style={{ perspective: '1200px' }}
          >
            {todayCard ? (
              <motion.div
                animate={isHovering ? { rotateX, rotateY, y: -8 } : { rotateX: 0, rotateY: 0, y: [-4, 4, -4] }}
                transition={isHovering ? { duration: 0.15 } : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-20 w-full max-w-[340px] sm:max-w-[380px] aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/15"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <Card card={todayCard} interactive={false} showAudio={false} />
                
                {/* Floating Day Stamp */}
                <div className="absolute top-3 left-3 z-30 px-3 py-1 bg-black/80 backdrop-blur-md border border-white/20 font-mono text-[10px] font-bold text-white uppercase tracking-widest rounded">
                  DAY #{String(today).padStart(3, '0')}
                </div>
              </motion.div>
            ) : (
              <div className="w-full max-w-[340px] aspect-[3/4] rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-white/20 border-t-[#FF1493] rounded-full animate-spin" />
                <span className="font-mono text-xs text-white/50 uppercase tracking-widest">Loading Today's Artifact...</span>
              </div>
            )}
          </div>

          {/* RIGHT: Today's Song Story & Primary Funnel Action */}
          <div className="flex flex-col justify-center">
            
            {/* Metadata Badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 bg-white/10 border border-white/20 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00E5FF]">
                TODAY'S RELEASE // {todayDateStr}
              </span>
              <span
                className="px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest border"
                style={{
                  color: moodAccent,
                  borderColor: `${moodAccent}40`,
                  background: `${moodAccent}15`,
                }}
              >
                {todaySong?.mood?.toUpperCase() || 'DARK'} REALM
              </span>
            </div>

            {/* Song Title */}
            <h2
              className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-white mb-2 leading-none"
              style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
            >
              {todaySong?.title || 'TODAY\'S TRANSMISSION'}
            </h2>

            {/* Sub-artist info */}
            <p className="font-mono text-xs text-white/50 uppercase tracking-widest mb-4">
              BY {todaySong?.artist || 'TH3SCR1B3'} • {todaySong?.bpm || 120} BPM • {todaySong?.genre?.join(', ') || 'Alternative'}
            </p>

            {/* Description / Story Snippet */}
            <p className="font-mono text-xs sm:text-sm text-white/70 leading-relaxed mb-6 border-l-2 border-white/20 pl-4 py-1">
              {todaySong?.description || 'Every release is a complete creative artifact—a song, an artwork, a story, a playable level, and a permanent collectible card.'}
            </p>

            {/* ── PRIMARY FUNNEL ACTIONS ── */}
            <div className="flex flex-col gap-3.5 mb-6">
              
              {/* 1. PLAY TODAY'S DROP (Hero Primary CTA) */}
              <button
                onClick={handlePlayDrop}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded bg-gradient-to-r from-[#FF1493] via-[#FF5500] to-[#E5B800] text-black font-black uppercase tracking-wider text-base hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(255,20,147,0.4)] cursor-pointer"
                style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
              >
                <Play size={22} className="fill-black" />
                <span>PLAY TODAY'S DROP (~90s GAME)</span>
              </button>

              {/* 2. SECONDARY ACTIONS ROW (LISTEN | ARTIFACT PAGE) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleToggleAudio}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-black/60 hover:bg-white/10 border border-white/25 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  {isTodayPlaying ? (
                    <>
                      <Pause size={16} className="text-[#39FF14]" />
                      <span>PAUSE AUDIO</span>
                    </>
                  ) : (
                    <>
                      <Volume2 size={16} className="text-[#00E5FF]" />
                      <span>LISTEN NOW</span>
                    </>
                  )}
                </button>

                <Link
                  to={`/day/${today}`}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-black/60 hover:bg-white/10 border border-white/25 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] no-underline"
                >
                  <Info size={16} className="text-[#E5B800]" />
                  <span>VIEW FULL ARTIFACT</span>
                </Link>
              </div>

              {/* 3. GIVE ME A SIGN (Ritualistic Random Discovery) */}
              <button
                onClick={handleGiveMeASign}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-950/30 hover:bg-purple-900/40 border border-purple-500/40 text-purple-300 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
              >
                <Sparkles size={14} className="text-purple-400 animate-pulse" />
                <span>GIVE ME A SIGN (RANDOM DAY DISCOVERY)</span>
              </button>
            </div>

            {/* Quick Helper Text */}
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Shield size={12} />
              <span>100% Free Discovery • No Account or Wallet Required to Play</span>
            </div>

          </div>

        </div>

      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SECTION 2: THE 4 PILLARS OF THE 365 ECOSYSTEM                */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative z-10 py-16 bg-[#0a0805] border-y border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="font-mono text-[10px] text-[#00E5FF] uppercase font-bold tracking-[0.3em]">
              THE 365 ARCHITECTURE
            </span>
            <h3
              className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white mt-1"
              style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
            >
              SONG → EXPERIENCE → CARD → RETENTION
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Pillar 1: THE WORLD */}
            <Link
              to="/365"
              className="p-6 bg-black/60 border border-white/15 hover:border-[#00E5FF]/60 transition-all group flex flex-col justify-between rounded-xl no-underline"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF] mb-4 group-hover:scale-110 transition-transform">
                  <Compass size={20} />
                </div>
                <div className="font-mono text-[10px] text-[#00E5FF] font-bold uppercase tracking-widest mb-1">
                  01 // THE WORLD
                </div>
                <h4 className="font-bold text-lg text-white mb-2 uppercase">365 Archive</h4>
                <p className="font-mono text-xs text-white/60 leading-relaxed">
                  365 original songs and artifacts chronologically mapped. Explore by month, mood, or ritualistic discovery.
                </p>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-[#00E5FF] uppercase font-bold tracking-wider mt-6">
                <span>OPEN ARCHIVE</span>
                <ChevronRight size={12} />
              </div>
            </Link>

            {/* Pillar 2: THE EXPERIENCE */}
            <Link
              to="/pim"
              className="p-6 bg-black/60 border border-white/15 hover:border-[#FF1493]/60 transition-all group flex flex-col justify-between rounded-xl no-underline"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#FF1493]/10 border border-[#FF1493]/30 flex items-center justify-center text-[#FF1493] mb-4 group-hover:scale-110 transition-transform">
                  <Gamepad2 size={20} />
                </div>
                <div className="font-mono text-[10px] text-[#FF1493] font-bold uppercase tracking-widest mb-1">
                  02 // THE EXPERIENCE
                </div>
                <h4 className="font-bold text-lg text-white mb-2 uppercase">PIM Arcade</h4>
                <p className="font-mono text-xs text-white/60 leading-relaxed">
                  3-lane HTML5 canvas rhythm game. Master the beat, hit timing windows, and turn every song into an interactive challenge.
                </p>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-[#FF1493] uppercase font-bold tracking-wider mt-6">
                <span>LAUNCH PIM</span>
                <ChevronRight size={12} />
              </div>
            </Link>

            {/* Pillar 3: OWNERSHIP */}
            <Link
              to="/vault"
              className="p-6 bg-black/60 border border-white/15 hover:border-[#E5B800]/60 transition-all group flex flex-col justify-between rounded-xl no-underline"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#E5B800]/10 border border-[#E5B800]/30 flex items-center justify-center text-[#E5B800] mb-4 group-hover:scale-110 transition-transform">
                  <Layers size={20} />
                </div>
                <div className="font-mono text-[10px] text-[#E5B800] font-bold uppercase tracking-widest mb-1">
                  03 // OWNERSHIP
                </div>
                <h4 className="font-bold text-lg text-white mb-2 uppercase">TH3VAULT</h4>
                <p className="font-mono text-xs text-white/60 leading-relaxed">
                  Collect cards through daily plays, burn duplicates into V⚡ tokens, forge rarities, and bind proofs to Base EVM.
                </p>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-[#E5B800] uppercase font-bold tracking-wider mt-6">
                <span>ENTER VAULT</span>
                <ChevronRight size={12} />
              </div>
            </Link>

            {/* Pillar 4: IDENTITY */}
            <Link
              to="/hub"
              className="p-6 bg-black/60 border border-white/15 hover:border-[#A855F7]/60 transition-all group flex flex-col justify-between rounded-xl no-underline"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#A855F7]/10 border border-[#A855F7]/30 flex items-center justify-center text-[#A855F7] mb-4 group-hover:scale-110 transition-transform">
                  <Zap size={20} />
                </div>
                <div className="font-mono text-[10px] text-[#A855F7] font-bold uppercase tracking-widest mb-1">
                  04 // IDENTITY
                </div>
                <h4 className="font-bold text-lg text-white mb-2 uppercase">YOUR 365</h4>
                <p className="font-mono text-xs text-white/60 leading-relaxed">
                  Your personal relationship with the project. Track days experienced, streak milestones, cards earned, and your sovereign passport.
                </p>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-[#A855F7] uppercase font-bold tracking-wider mt-6">
                <span>VIEW YOUR HUB</span>
                <ChevronRight size={12} />
              </div>
            </Link>

          </div>

        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SECTION 3: RECENT 365 RELEASES REEL                           */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative z-10 py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <div>
            <span className="font-mono text-[10px] text-[#FF5500] uppercase font-bold tracking-widest">
              LATEST TRANSMISSIONS
            </span>
            <h3
              className="text-2xl sm:text-3xl font-black uppercase text-white"
              style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
            >
              RECENT DAILY DROPS
            </h3>
          </div>

          <Link
            to="/365"
            className="flex items-center gap-2 font-mono text-xs uppercase font-bold text-[#E5B800] hover:text-white transition-colors no-underline"
          >
            <span>VIEW ALL 365 DAYS</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {recentSongs.map(s => {
            const isPlayingThis = isPlaying && currentTrack && currentTrack.day === s.day;
            return (
              <div
                key={s.id}
                className="group relative bg-[#0e0c08] border border-white/10 hover:border-white/40 transition-all rounded-lg overflow-hidden flex flex-col"
              >
                {/* Cover Image */}
                <div className="relative aspect-square overflow-hidden bg-black">
                  <img
                    src={s.coverArt || '/data/covers/default.jpg'}
                    alt={s.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-black/80 font-mono text-[9px] font-bold text-white rounded">
                    #{String(s.day).padStart(3, '0')}
                  </div>

                  {/* Play/Listen Quick Overlay */}
                  <button
                    onClick={() => {
                      playGlobal({
                        title: s.title,
                        artist: s.artist || 'th3scr1b3',
                        audioUrl: s.audioUrl,
                        coverUrl: s.coverArt || '',
                        day: s.day,
                        rarity: 'common',
                        isDailyClaim: true,
                        maxDuration: 0,
                      });
                      audioManager.playSfx('select_start_song', 0.3);
                    }}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                    title={`Listen to ${s.title}`}
                  >
                    {isPlayingThis ? (
                      <Pause size={28} className="text-[#39FF14]" />
                    ) : (
                      <Play size={28} className="text-white fill-white" />
                    )}
                  </button>
                </div>

                {/* Info & Links */}
                <div className="p-3 flex flex-col justify-between flex-1">
                  <div>
                    <h5 className="font-mono text-xs font-bold text-white uppercase truncate">
                      {s.title}
                    </h5>
                    <span className="font-mono text-[9px] text-white/40 uppercase block mt-0.5">
                      {s.mood.toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                    <Link
                      to={`/day/${s.day}`}
                      className="font-mono text-[9px] text-white/70 hover:text-white uppercase font-bold no-underline"
                    >
                      Artifact →
                    </Link>
                    <Link
                      to={`/play/${s.id}`}
                      className="font-mono text-[9px] text-[#FF1493] hover:text-pink-300 uppercase font-bold no-underline"
                    >
                      Play ⚡
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SECTION 4: THE WARP INVITATION                                */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative z-10 py-16 bg-gradient-to-b from-[#0e0a14] to-[#050402] border-t border-white/10 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <span className="font-mono text-[10px] text-purple-400 uppercase font-bold tracking-[0.3em] block mb-2">
            STRANGE PLACES INSIDE THE 365 UNIVERSE
          </span>
          <h3
            className="text-3xl sm:text-4xl font-black uppercase text-white mb-4"
            style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
          >
            ENTER THE WARP ZONE
          </h3>
          <p className="font-mono text-xs sm:text-sm text-white/60 leading-relaxed mb-8">
            Explore the Mood Map, cyber brutalist ASCII terminals, sacred geometry audio visualizers, and the complete lost-and-found hard drive lore archive.
          </p>
          <Link
            to="/warp"
            className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs uppercase font-black tracking-widest rounded shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all hover:scale-105 no-underline"
          >
            <Sparkles size={16} />
            <span>EXPLORE WARP EXPERIENCES</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

    </div>
  );
}
