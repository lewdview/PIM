/**
 * DayArtifactPage.tsx — Atomic Creative Artifact Experience (/day/:day)
 *
 * Answers for every day:
 * "What is this?" → Creative context, artwork & title
 * "Can I hear it?" → Instant lossless Web Audio playback
 * "What does it mean?" → Poetic lyrics & narrative context
 * "Can I experience it?" → Audio-reactive waveforms & ASCII visualizer
 * "Can I play it?" → 90-second PIM Rhythm level
 * "Can I collect it?" → Collectible Card, Edition & Proofs
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Volume2, Sparkles, ChevronLeft, ChevronRight,
  Gamepad2, Layers, BookOpen, Clock, Lock, Share2, Award,
  CheckCircle, ArrowLeft, Terminal, Shuffle, Disc, Info
} from 'lucide-react';
import { getCurrentDay, getDateFromDay, formatDate } from '../utils/dayCalc';
import { loadCatalog, type GameSong } from '../game/api';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { useVaultStore } from '../store/useVaultStore';
import { audioManager } from '../game/audio';
import { getCardByDay, type VaultCard } from '../services/vaultService';
import Card from '../components/Card';
import { RARITY_CONFIG } from '../utils/rarity';
import SongLeaderboard from '../components/SongLeaderboard';

export default function DayArtifactPage() {
  const params = useParams<{ day?: string }>();
  const [, setLocation] = useLocation();
  const today = getCurrentDay();

  // Parse day parameter safely
  const dayNum = useMemo(() => {
    const raw = params.day || '1';
    const parsed = parseInt(raw.replace(/\D/g, ''), 10);
    if (isNaN(parsed) || parsed < 1) return 1;
    return parsed;
  }, [params.day]);

  const isFuture = dayNum > today;

  const [song, setSong] = useState<GameSong | null>(null);
  const [card, setCard] = useState<VaultCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'context' | 'lyrics' | 'ascii' | 'card' | 'leaderboard'>('context');
  const [copied, setCopied] = useState(false);

  // Global Player
  const currentTrack = useGlobalPlayer(s => s.currentTrack);
  const isPlaying = useGlobalPlayer(s => s.isPlaying);
  const playGlobal = useGlobalPlayer(s => s.play);
  const pauseGlobal = useGlobalPlayer(s => s.pause);

  const isCurrentPlaying = Boolean(
    isPlaying && currentTrack && (currentTrack.day === dayNum || (song && currentTrack.audioUrl === song.audioUrl))
  );

  // Collection State
  const collection = useVaultStore(s => s.collection);
  const ownedCard = useMemo(() => {
    if (!Array.isArray(collection)) return null;
    return collection.find(c => c && (c.card?.day === dayNum || c.cardId === `card-${dayNum}`));
  }, [collection, dayNum]);

  // Load song and card metadata
  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      loadCatalog(),
      getCardByDay(dayNum).catch(() => null),
    ]).then(([catalog, loadedCard]) => {
      if (!active) return;
      const matched = catalog.find(s => s.day === dayNum) || catalog.find(s => s.day === (dayNum % (catalog.length || 1)));
      setSong(matched || null);
      setCard(loadedCard);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [dayNum]);

  // Direct Audio Toggle
  const handleToggleAudio = useCallback(() => {
    if (!song) return;
    if (isCurrentPlaying) {
      pauseGlobal();
      audioManager.playSfx('pause', 0.2);
    } else {
      audioManager.playSfx('select_start_song', 0.3);
      playGlobal({
        title: song.title,
        artist: song.artist || 'th3scr1b3',
        audioUrl: song.audioUrl,
        coverUrl: song.coverArt || card?.coverUrl || '',
        day: song.day || dayNum,
        rarity: ownedCard?.card?.rarity || (ownedCard as any)?.rarity || card?.rarity || 'common',
        isDailyClaim: true,
        maxDuration: 0,
      });
    }
  }, [song, card, ownedCard, isCurrentPlaying, playGlobal, pauseGlobal, dayNum]);

  // Direct Play Launch
  const handlePlayPIM = useCallback(() => {
    audioManager.playSfx('select_start_song', 0.5);
    localStorage.setItem('pim_tutorial_completed', 'true');
    localStorage.setItem('has_onboarded', 'true');
    useVaultStore.getState().updateProgression({ tutorialCompleted: true }).catch(() => {});
    useVaultStore.getState().completeOnboarding().catch(() => {});
    
    if (song?.id) {
      setLocation(`/play/${song.id}`);
    } else {
      setLocation(`/play/day-${dayNum}`);
    }
  }, [song, dayNum, setLocation]);

  // Give Me A Sign
  const handleGiveMeASign = useCallback(() => {
    audioManager.playSfx('open_chest', 0.6);
    const randomDay = Math.floor(Math.random() * today) + 1;
    setLocation(`/day/${randomDay}`);
  }, [today, setLocation]);

  // Share URL
  const handleShare = useCallback(() => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      audioManager.playSfx('tap_nav', 0.3);
    }
  }, []);

  const dateStr = useMemo(() => {
    const d = getDateFromDay(dayNum);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, [dayNum]);

  const moodColor = song?.mood === 'light' ? '#39FF14' : '#FF1493';

  // Generate ASCII visualizer representation for song
  const asciiArt = useMemo(() => {
    if (!song) return '';
    const title = song.title.toUpperCase();
    const dayStr = String(dayNum).padStart(3, '0');
    return `
 ┌────────────────────────────────────────────────────────┐
 │  TH3SCR1B3 // 365 DAYS OF LIGHT & DARK                 │
 │  DAY #${dayStr} — [${song.mood.toUpperCase()} REALM]                          │
 ├────────────────────────────────────────────────────────┤
 │                                                        │
 │      ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄         │
 │      █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█         │
 │      █  TITLE  : ${title.padEnd(29)}█         │
 │      █  TEMPO  : ${String(song.bpm || 120).padEnd(4)} BPM                      █         │
 │      █  VALENCE: ${String(song.valence || 0.5).padEnd(4)} / 1.00                  █         │
 │      █  GENRE  : ${(song.genre?.join('/') || 'EXPERIMENTAL').slice(0, 29).padEnd(29)}█         │
 │      █  STATUS : SYNCHRONIZED / READY         █         │
 │      █▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█         │
 │                                                        │
 └────────────────────────────────────────────────────────┘
`;
  }, [song, dayNum]);

  if (isFuture) {
    return (
      <div className="flex-1 w-full min-h-screen bg-[#050402] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/20 flex items-center justify-center text-white/40 mb-4">
          <Lock size={28} />
        </div>
        <div className="font-mono text-xs text-[#FF5500] uppercase font-bold tracking-[0.3em] mb-2">
          TRANSMISSION LOCKED
        </div>
        <h1
          className="text-4xl font-black uppercase text-white mb-4"
          style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
        >
          DAY #{dayNum} IS IN THE FUTURE
        </h1>
        <p className="font-mono text-xs text-white/60 max-w-md uppercase leading-relaxed mb-8">
          The 365 timeline releases exactly one original artifact per calendar day. Day #{dayNum} has not arrived yet. Current release is Day #{today}.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            to={`/day/${today}`}
            className="px-6 py-3 bg-[#E5B800] text-black font-mono text-xs uppercase font-black tracking-wider rounded no-underline hover:scale-105 transition-transform"
          >
            Go to Today's Release (#{today})
          </Link>
          <Link
            to="/365"
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-mono text-xs uppercase font-bold tracking-wider rounded no-underline transition-colors"
          >
            Open 365 Archive
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full min-h-screen bg-[#050402] text-white select-none relative pb-24">
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute top-[10%] left-[50%] -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-[200px] opacity-15"
          style={{ background: `radial-gradient(circle, ${moodColor}, transparent 70%)` }}
        />
      </div>

      {/* Top Breadcrumbs & Previous/Next Navigation */}
      <section className="relative z-10 border-b border-white/10 bg-[#080604]/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 font-mono text-xs">
          
          {/* Back to 365 Archive */}
          <Link
            to="/365"
            className="flex items-center gap-1.5 text-white/60 hover:text-white uppercase tracking-wider no-underline transition-colors"
          >
            <ArrowLeft size={14} />
            <span>365 ARCHIVE</span>
          </Link>

          {/* Stepper Controls */}
          <div className="flex items-center gap-2">
            {dayNum > 1 ? (
              <Link
                to={`/day/${dayNum - 1}`}
                className="flex items-center gap-1 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded uppercase tracking-wider text-white/70 hover:text-white no-underline transition-all"
                title={`Previous Day (#${dayNum - 1})`}
              >
                <ChevronLeft size={13} />
                <span className="hidden sm:inline">DAY #{dayNum - 1}</span>
              </Link>
            ) : (
              <span className="px-3 py-1 text-white/20 uppercase tracking-wider">START</span>
            )}

            <button
              onClick={handleGiveMeASign}
              className="flex items-center gap-1 px-3 py-1 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/40 text-purple-300 rounded uppercase tracking-wider transition-all cursor-pointer"
              title="Give Me A Sign (Random Day)"
            >
              <Shuffle size={12} />
              <span className="hidden sm:inline">RANDOM</span>
            </button>

            {dayNum < today ? (
              <Link
                to={`/day/${dayNum + 1}`}
                className="flex items-center gap-1 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded uppercase tracking-wider text-white/70 hover:text-white no-underline transition-all"
                title={`Next Day (#${dayNum + 1})`}
              >
                <span className="hidden sm:inline">DAY #{dayNum + 1}</span>
                <ChevronRight size={13} />
              </Link>
            ) : (
              <span className="px-3 py-1 text-[#E5B800] border border-[#E5B800]/40 rounded font-bold uppercase tracking-wider">
                TODAY
              </span>
            )}
          </div>

          {/* Share Action */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-white/60 hover:text-white uppercase tracking-wider cursor-pointer"
            title="Copy Artifact Link"
          >
            <Share2 size={13} />
            <span className="hidden sm:inline">{copied ? 'COPIED!' : 'SHARE'}</span>
          </button>
        </div>
      </section>

      {/* Main Artifact Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#00E5FF] rounded-full animate-spin" />
            <span className="font-mono text-xs uppercase tracking-widest text-[#00E5FF]">
              DECRYPTING ARTIFACT #{dayNum}...
            </span>
          </div>
        ) : !song ? (
          <div className="py-24 text-center">
            <p className="font-mono text-sm text-white/60 uppercase">ARTIFACT FAILED TO LOAD</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-10 items-start">
            
            {/* LEFT COLUMN: Cover Artwork / Card View + Primary Controls */}
            <div className="flex flex-col gap-6">
              
              {/* Artwork Pedestal */}
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] group">
                <img
                  src={song.coverArt || card?.coverUrl || '/data/covers/default.jpg'}
                  alt={song.title}
                  className="w-full h-full object-cover"
                />

                {/* Ambient vinyl disc peek */}
                <div className="absolute top-3 right-3 px-3 py-1 bg-black/80 backdrop-blur-md rounded font-mono text-[10px] font-bold text-white uppercase tracking-widest border border-white/20">
                  DAY #{String(dayNum).padStart(3, '0')}
                </div>

                {/* Instant Listen Action Button */}
                <button
                  onClick={handleToggleAudio}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.6)]">
                    {isCurrentPlaying ? <Pause size={28} /> : <Play size={28} className="fill-black ml-1" />}
                  </div>
                  <span className="font-mono text-xs font-black uppercase tracking-wider text-white">
                    {isCurrentPlaying ? 'PAUSE STREAM' : 'LISTEN TO TRACK'}
                  </span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {/* 1. PLAY IN PIM (Primary Experience Action) */}
                <button
                  onClick={handlePlayPIM}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded bg-gradient-to-r from-[#FF1493] via-[#FF5500] to-[#E5B800] text-black font-black uppercase tracking-wider text-base hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_25px_rgba(255,20,147,0.4)] cursor-pointer"
                  style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
                >
                  <Gamepad2 size={22} className="text-black" />
                  <span>PLAY IN PIM (~90s GAME)</span>
                </button>

                {/* 2. Audio Toggle */}
                <button
                  onClick={handleToggleAudio}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/25 rounded font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  {isCurrentPlaying ? (
                    <>
                      <Pause size={16} className="text-[#39FF14]" />
                      <span>PAUSE AUDIO PLAYBACK</span>
                    </>
                  ) : (
                    <>
                      <Volume2 size={16} className="text-[#00E5FF]" />
                      <span>LISTEN TO FULL TRACK</span>
                    </>
                  )}
                </button>
              </div>

              {/* Ownership / Collect Status */}
              <div className="p-4 bg-[#0d0b07] border border-white/15 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Layers size={18} className="text-[#E5B800]" />
                  </div>
                  <div>
                    <div className="font-mono text-[9px] text-white/50 uppercase tracking-widest">
                      COLLECTIBLE STATUS
                    </div>
                    <div className="font-bold text-xs uppercase text-white flex items-center gap-1.5 mt-0.5">
                      {ownedCard ? (
                        <>
                          <CheckCircle size={13} className="text-[#39FF14]" />
                          <span className="text-[#39FF14]">
                            OWNED IN VAULT ({((ownedCard.card?.rarity || (ownedCard as any)?.rarity || 'common') as string).toUpperCase()})
                          </span>
                        </>
                      ) : (
                        <span>UNCLAIMED • PLAY PIM TO UNLOCK</span>
                      )}
                    </div>
                  </div>
                </div>

                <Link
                  to="/vault"
                  className="font-mono text-[10px] text-[#E5B800] uppercase font-bold hover:underline no-underline"
                >
                  VAULT →
                </Link>
              </div>

            </div>

            {/* RIGHT COLUMN: Metadata, Tabs (Context, Lyrics, ASCII, Card Details) */}
            <div className="flex flex-col">
              
              {/* Header Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-3 py-1 bg-white/10 border border-white/20 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00E5FF]">
                  {dateStr}
                </span>
                <span
                  className="px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest border"
                  style={{
                    color: moodColor,
                    borderColor: `${moodColor}40`,
                    background: `${moodColor}15`,
                  }}
                >
                  {song.mood.toUpperCase()} REALM
                </span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 font-mono text-[10px] font-bold uppercase tracking-widest text-white/60">
                  {song.bpm || 120} BPM
                </span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 font-mono text-[10px] font-bold uppercase tracking-widest text-white/60">
                  {song.genre?.join(', ') || 'ALTERNATIVE'}
                </span>
              </div>

              {/* Master Song Title */}
              <h1
                className="text-4xl sm:text-6xl font-black uppercase text-white tracking-tight mb-2 leading-none"
                style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
              >
                {song.title}
              </h1>

              <div className="font-mono text-xs text-white/50 uppercase tracking-widest mb-6">
                COMPOSED & PRODUCED BY <strong className="text-white">{song.artist || 'TH3SCR1B3'}</strong>
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-white/15 pb-2 mb-6 font-mono text-xs font-bold uppercase tracking-wider flex-wrap">
                <button
                  onClick={() => setActiveTab('context')}
                  className={`px-4 py-2 rounded transition-all cursor-pointer ${
                    activeTab === 'context'
                      ? 'bg-white text-black font-black'
                      : 'text-white/60 hover:text-white bg-white/5'
                  }`}
                >
                  STORY & CONTEXT
                </button>
                <button
                  onClick={() => setActiveTab('lyrics')}
                  className={`px-4 py-2 rounded transition-all cursor-pointer ${
                    activeTab === 'lyrics'
                      ? 'bg-white text-black font-black'
                      : 'text-white/60 hover:text-white bg-white/5'
                  }`}
                >
                  LYRICS / WORDS
                </button>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className={`px-4 py-2 rounded transition-all cursor-pointer ${
                    activeTab === 'leaderboard'
                      ? 'bg-white text-black font-black'
                      : 'text-white/60 hover:text-white bg-white/5'
                  }`}
                >
                  LEADERBOARD
                </button>
                <button
                  onClick={() => setActiveTab('ascii')}
                  className={`px-4 py-2 rounded transition-all cursor-pointer ${
                    activeTab === 'ascii'
                      ? 'bg-white text-black font-black'
                      : 'text-white/60 hover:text-white bg-white/5'
                  }`}
                >
                  ASCII EXPERIMENT
                </button>
              </div>

              {/* Tab 1: Story & Context */}
              {activeTab === 'context' && (
                <div className="flex flex-col gap-6">
                  <div className="p-6 bg-[#0a0805] border border-white/10 rounded-xl leading-relaxed font-mono text-sm text-white/80 space-y-4">
                    <p className="text-base text-white font-sans font-medium leading-relaxed">
                      {song.description || 'This track is part of the 365 Days of Light & Dark release archive. Each day explores dualities between intense digital energy and raw acoustic introspection.'}
                    </p>
                    <p className="text-xs text-white/50 leading-relaxed">
                      "Years ago I lost much of my music in a hard drive failure. I recovered what I could. Rather than letting those songs disappear, I decided to release one every day. Every release becomes something you can play, collect, and remember."
                    </p>
                  </div>

                  {/* Technical Audio Parameters Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
                      <span className="text-[9px] text-white/40 uppercase block">VALENCE</span>
                      <span className="text-lg font-bold text-[#00E5FF]">{song.valence || 0.45}</span>
                    </div>
                    <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
                      <span className="text-[9px] text-white/40 uppercase block">TEMPO</span>
                      <span className="text-lg font-bold text-[#E5B800]">{song.bpm || 120} BPM</span>
                    </div>
                    <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
                      <span className="text-[9px] text-white/40 uppercase block">DIFFICULTY</span>
                      <span className="text-lg font-bold text-[#FF1493]">LVL {song.difficultyLevel || 5}</span>
                    </div>
                    <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
                      <span className="text-[9px] text-white/40 uppercase block">FORMAT</span>
                      <span className="text-lg font-bold text-[#39FF14]">LOSSLESS WAV</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Lyrics */}
              {activeTab === 'lyrics' && (
                <div className="p-6 bg-[#0a0805] border border-white/10 rounded-xl">
                  {song.lyrics ? (
                    <pre className="font-mono text-xs sm:text-sm text-white/80 whitespace-pre-wrap leading-loose">
                      {song.lyrics}
                    </pre>
                  ) : (
                    <div className="text-center py-12 font-mono text-xs text-white/50 uppercase">
                      <BookOpen size={24} className="mx-auto mb-2 opacity-50" />
                      LYRIC TRANSCRIPTIONS ARE BEING SYNCHRONIZED FROM MASTER MANUSCRIPT.
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Global Leaderboard */}
              {activeTab === 'leaderboard' && (
                <div className="p-2 sm:p-4 bg-[#0a0805] border border-white/10 rounded-xl">
                  <SongLeaderboard
                    songId={song.id || `day-${dayNum}`}
                    defaultLimit={10}
                    title={`DAY ${dayNum} GLOBAL TRANSMISSION RANKINGS`}
                  />
                </div>
              )}

              {/* Tab 3: ASCII Terminal */}
              {activeTab === 'ascii' && (
                <div className="p-4 bg-black border border-white/20 rounded-xl overflow-x-auto">
                  <div className="flex items-center gap-2 pb-2 mb-2 border-b border-white/10 font-mono text-[10px] text-[#39FF14]">
                    <Terminal size={13} />
                    <span>TERMINAL_OUTPUT // DAY_{dayNum}</span>
                  </div>
                  <pre className="font-mono text-[10px] sm:text-xs text-[#39FF14] leading-tight select-all">
                    {asciiArt}
                  </pre>
                </div>
              )}

            </div>

          </div>
        )}
      </main>

    </div>
  );
}
