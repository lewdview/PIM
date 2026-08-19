/**
 * Archive365Page.tsx — The 365 Days of Light & Dark Chronological Archive
 *
 * 365 DAYS. 365 ARTIFACTS. ONE CONTINUOUS JOURNEY.
 *
 * Features:
 * - Interactive Month Jump Carousel (Jan–Dec).
 * - "Today's Release" High-Visibility Indicator.
 * - "GIVE ME A SIGN" Ritualistic Random Day Discovery.
 * - Filter by Realm (All, Light, Dark, Owned, Mastered).
 * - Live Audio Previews via Persistent Global Player.
 * - Deep Link to Atomic Day Artifact (/day/:day) or Direct Play in PIM (/play/:songId).
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import {
  Calendar, Search, Sparkles, Filter, Play, Pause, Lock, CheckCircle,
  Volume2, Compass, Layers, Flame, ArrowUpRight, Shuffle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { getCurrentDay, getDateFromDay, formatDate } from '../utils/dayCalc';
import { loadCatalog, type GameSong } from '../game/api';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { useVaultStore } from '../store/useVaultStore';
import { audioManager } from '../game/audio';
import { fetchAllCards, type VaultCard } from '../services/vaultService';
import { RARITY_CONFIG } from '../utils/rarity';
import { CHAPTERS } from '../game/campaign';
import PrizeRibbonSvg from '../components/ui/PrizeRibbonSvg';

type RealmFilter = 'all' | 'light' | 'dark' | 'owned';

export default function Archive365Page() {
  const [, setLocation] = useLocation();
  const today = getCurrentDay();
  
  const [catalog, setCatalog] = useState<GameSong[]>([]);
  const [cardsPool, setCardsPool] = useState<VaultCard[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = All months, 1..12 = specific month
  const [realmFilter, setRealmFilter] = useState<RealmFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Global Player
  const currentTrack = useGlobalPlayer(s => s.currentTrack);
  const isPlaying = useGlobalPlayer(s => s.isPlaying);
  const playGlobal = useGlobalPlayer(s => s.play);
  const pauseGlobal = useGlobalPlayer(s => s.pause);

  // Vault State
  const collection = useVaultStore(s => s.collection);
  const claimedRewards = useVaultStore(s => s.claimedRewards);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadCatalog(),
      fetchAllCards().catch(() => []),
    ]).then(([songs, cards]) => {
      if (!active) return;
      setCatalog(songs);
      setCardsPool(cards);
      setLoading(false);
    });
    return () => {
      active = active = false;
    };
  }, []);

  // Map of owned cards by day
  const ownedDaysMap = useMemo(() => {
    const map = new Map<number, any>();
    if (Array.isArray(collection)) {
      collection.forEach(c => {
        if (!c) return;
        const day = c.card?.day || (c.cardId?.startsWith('card-') ? parseInt(c.cardId.replace('card-', ''), 10) : null);
        if (day) map.set(day, c);
      });
    }
    return map;
  }, [collection]);

  // Determine month for a day
  const getMonthForDay = (day: number): number => {
    if (day <= 31) return 1;
    if (day <= 59) return 2;
    if (day <= 90) return 3;
    if (day <= 120) return 4;
    if (day <= 151) return 5;
    if (day <= 181) return 6;
    if (day <= 212) return 7;
    if (day <= 243) return 8;
    if (day <= 273) return 9;
    if (day <= 304) return 10;
    if (day <= 334) return 11;
    return 12;
  };

  // Filtered days list
  const filteredCatalog = useMemo(() => {
    return catalog.filter(song => {
      // Month Filter
      if (selectedMonth > 0 && getMonthForDay(song.day) !== selectedMonth) {
        return false;
      }

      // Realm / Owned Filter
      if (realmFilter === 'light' && song.mood !== 'light') return false;
      if (realmFilter === 'dark' && song.mood !== 'dark') return false;
      if (realmFilter === 'owned' && !ownedDaysMap.has(song.day)) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = song.title.toLowerCase().includes(q);
        const matchesDay = String(song.day) === q || `day ${song.day}`.includes(q) || `day-${song.day}`.includes(q);
        const matchesMood = song.mood.toLowerCase().includes(q);
        const matchesGenre = song.genre?.some(g => g.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDay && !matchesMood && !matchesGenre) return false;
      }

      return true;
    });
  }, [catalog, selectedMonth, realmFilter, searchQuery, ownedDaysMap]);

  // Ritualistic Random Day
  const handleGiveMeASign = useCallback(() => {
    audioManager.playSfx('open_chest', 0.6);
    const randomDay = Math.floor(Math.random() * today) + 1;
    setLocation(`/day/${randomDay}`);
  }, [today, setLocation]);

  const monthNames = [
    'ALL MONTHS', 'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  return (
    <div className="flex-1 w-full min-h-screen bg-[#050402] text-white select-none relative pb-24">
      {/* Background ambient grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none z-0" />

      {/* Header Banner */}
      <section className="relative z-10 border-b border-white/10 bg-[#0a0805] px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="font-mono text-[10px] text-[#00E5FF] uppercase font-bold tracking-[0.3em]">
                CHRONOLOGICAL ARTIFACT ARCHIVE
              </span>
            </div>
            <h1
              className="text-3xl sm:text-5xl font-black uppercase text-white tracking-tight"
              style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
            >
              365 DAYS OF LIGHT & DARK
            </h1>
            <p className="font-mono text-xs text-white/60 uppercase tracking-widest mt-1">
              365 DAYS • 365 ARTIFACTS • ONE CONTINUOUS CREATIVE EXPERIMENT
            </p>
          </div>

          {/* Quick Sign CTA & Stats */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleGiveMeASign}
              className="flex items-center gap-2 px-5 py-3 rounded bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-mono text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Sparkles size={16} />
              <span>GIVE ME A SIGN</span>
            </button>

            <Link
              to={`/day/${today}`}
              className="flex items-center gap-2 px-5 py-3 rounded bg-[#E5B800] hover:bg-yellow-400 text-black font-mono text-xs font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 no-underline"
            >
              <span>TODAY (DAY #{today})</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Controls: Month Jump & Filters */}
      <section className="relative z-10 border-b border-white/10 bg-[#080604]/90 backdrop-blur-md sticky top-14 sm:top-16 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          
          {/* Month Selector Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
            {monthNames.map((name, idx) => {
              const isActive = selectedMonth === idx;
              return (
                <button
                  key={name}
                  onClick={() => {
                    setSelectedMonth(idx);
                    audioManager.playSfx('tap_nav', 0.2);
                  }}
                  className={`px-3 py-1.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-black font-black shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {/* Search & Realm Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="SEARCH DAY #, TITLE, GENRE, OR MOOD..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-black/60 border border-white/15 focus:border-[#00E5FF] rounded font-mono text-xs text-white placeholder:text-white/30 uppercase tracking-wider outline-none transition-colors"
              />
            </div>

            {/* Realm Filters */}
            <div className="flex items-center gap-1 bg-black/60 p-1 border border-white/15 rounded">
              {(['all', 'light', 'dark', 'owned'] as RealmFilter[]).map(filter => {
                const isActive = realmFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => {
                      setRealmFilter(filter);
                      audioManager.playSfx('tap_nav', 0.2);
                    }}
                    className={`px-3 py-1 rounded font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isActive
                        ? filter === 'light'
                          ? 'bg-[#39FF14] text-black font-black'
                          : filter === 'dark'
                          ? 'bg-[#FF1493] text-white font-black'
                          : filter === 'owned'
                          ? 'bg-[#E5B800] text-black font-black'
                          : 'bg-white text-black font-black'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {filter === 'all' ? 'ALL REALMS' : filter.toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/* Counter */}
            <div className="font-mono text-[11px] text-white/50 uppercase tracking-widest">
              SHOWING <strong className="text-white">{filteredCatalog.length}</strong> / 365 ARTIFACTS
            </div>

          </div>

        </div>
      </section>

      {/* Main Grid of 365 Days */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#00E5FF] rounded-full animate-spin" />
            <span className="font-mono text-xs uppercase tracking-widest text-[#00E5FF]">
              CALIBRATING 365 TIMELINE...
            </span>
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-mono text-sm text-white/50 uppercase tracking-wider mb-4">
              NO TRANSMISSIONS MATCH YOUR CRITERIA
            </p>
            <button
              onClick={() => {
                setSelectedMonth(0);
                setRealmFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 font-mono text-xs uppercase font-bold text-white rounded cursor-pointer"
            >
              RESET FILTERS
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredCatalog.map(song => {
              const isToday = song.day === today;
              const isFuture = song.day > today;
              const ownedCard = ownedDaysMap.get(song.day);
              const isOwned = Boolean(ownedCard);
              const isCurrentlyPlaying = isPlaying && currentTrack && currentTrack.day === song.day;
              const dateStr = formatDate(song.date || getDateFromDay(song.day).toISOString());
              const moodColor = song.mood === 'light' ? '#39FF14' : '#FF1493';

              return (
                <div
                  key={song.id || song.day}
                  className={`group relative bg-[#0d0b07] border rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 ${
                    isToday
                      ? 'border-[#E5B800] shadow-[0_0_20px_rgba(229,184,0,0.3)] ring-1 ring-[#E5B800]'
                      : isOwned
                      ? 'border-white/30 hover:border-white/60'
                      : isFuture
                      ? 'border-white/5 opacity-50'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  {/* Card Artwork Image / Lock State */}
                  <div className="relative aspect-square overflow-hidden bg-black">
                    <img
                      src={song.coverArt || '/data/covers/default.jpg'}
                      alt={song.title}
                      loading="lazy"
                      className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                        isFuture ? 'filter grayscale brightness-50' : ''
                      }`}
                    />

                    {/* Gradient bottom scrim */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                    {/* Day Pill */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 backdrop-blur-md rounded font-mono text-[9px] font-black text-white uppercase tracking-wider border border-white/15">
                      #{String(song.day).padStart(3, '0')}
                    </div>

                    {/* Status Badges */}
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      {isToday && (
                        <span className="px-1.5 py-0.5 bg-[#E5B800] text-black font-mono font-black text-[8px] rounded uppercase animate-pulse">
                          TODAY
                        </span>
                      )}
                      {isOwned && (
                        <CheckCircle size={14} className="text-[#39FF14] drop-shadow-[0_0_6px_#39FF14]" />
                      )}
                      {isFuture && (
                        <Lock size={13} className="text-white/40" />
                      )}
                    </div>

                    {/* Instant Listen / Play Preview Overlay */}
                    {!isFuture && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isCurrentlyPlaying) {
                            pauseGlobal();
                            audioManager.playSfx('pause', 0.2);
                          } else {
                            playGlobal({
                              title: song.title,
                              artist: song.artist || 'th3scr1b3',
                              audioUrl: song.audioUrl,
                              coverUrl: song.coverArt || '',
                              day: song.day,
                              rarity: ownedCard?.card?.rarity || (ownedCard as any)?.rarity || 'common',
                              isDailyClaim: true,
                              maxDuration: 0,
                            });
                            audioManager.playSfx('select_start_song', 0.3);
                          }
                        }}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                        title={isCurrentlyPlaying ? 'Pause Audio' : `Listen to ${song.title}`}
                      >
                        {isCurrentlyPlaying ? (
                          <Pause size={32} className="text-[#39FF14] drop-shadow-[0_0_8px_#39FF14]" />
                        ) : (
                          <Play size={32} className="text-white fill-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Artifact Metadata */}
                  <div className="p-3 flex flex-col justify-between flex-1 bg-[#0a0805]">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className="font-mono text-[8px] font-black uppercase tracking-widest"
                          style={{ color: moodColor }}
                        >
                          {song.mood.toUpperCase()}
                        </span>
                        <span className="font-mono text-[8px] text-white/40 uppercase">
                          {dateStr}
                        </span>
                      </div>

                      <h4 className="font-mono text-xs font-bold text-white uppercase truncate" title={song.title}>
                        {song.title}
                      </h4>
                    </div>

                    {/* Action Pathways */}
                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between font-mono text-[9px] font-bold">
                      <Link
                        to={`/day/${song.day}`}
                        className="text-white/70 hover:text-white uppercase transition-colors no-underline flex items-center gap-0.5"
                      >
                        <span>Artifact</span>
                        <ArrowUpRight size={10} />
                      </Link>

                      {!isFuture ? (
                        <Link
                          to={`/play/${song.id}`}
                          className="text-[#FF1493] hover:text-pink-300 uppercase transition-colors no-underline"
                        >
                          Play PIM ⚡
                        </Link>
                      ) : (
                        <span className="text-white/30 uppercase">Locked</span>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </main>

    </div>
  );
}
