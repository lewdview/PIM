import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { loadCatalog } from "@/game/api";
import type { GameSong } from "@/game/api";
import {
  getTotalScore, getTotalPlatinums, getTotalCleared,
  getChapterPlatinums, getChapterCleared,
} from "@/game/progress";
import { CHAPTERS, type ChapterMeta } from "@/game/campaign";
import { getActiveTheme } from "@/lib/options";
import { audioManager } from "@/game/audio";
import { useVaultStore } from "@/store/useVaultStore";
import { Lock, Unlock, Play, Compass, CheckCircle2, ChevronRight, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── animated score counter ───────────────────────────────────────
function useCountUp(target: number, duration = 1500, delay = 200) {
  const [value, setValue] = useState(0);
  const [done, setDone]   = useState(false);
  useEffect(() => {
    if (!target) {
      setValue(0);
      setDone(true);
      return;
    }
    setValue(0);
    setDone(false);

    const t0 = setTimeout(() => {
      const start = Date.now();
      const tick  = () => {
        const p    = Math.min(1, (Date.now() - start) / duration);
        const ease = 1 - Math.pow(1 - p, 4);
        setValue(Math.round(ease * target));
        if (p < 1) requestAnimationFrame(tick);
        else { setValue(target); setDone(true); }
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t0);
  }, [target, duration, delay]);
  return { value, done };
}

function ScoreDisplay({ total, isAvant }: { total: number; isAvant?: boolean }) {
  const { value, done } = useCountUp(total);
  const str = value.toLocaleString();

  if (isAvant) {
    return (
      <div className="relative flex flex-col items-center">
        {!done && <div style={{ position: 'absolute', left: -20, right: -20, zIndex: 10, background: 'rgba(57,255,20,0.5)', height: 1 }} />}
        <div className="font-mono font-bold tabular-nums text-center whitespace-nowrap flex items-center justify-center text-[#39FF14]"
          style={{
            fontSize: 'clamp(28px, 6vw, 42px)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            textShadow: '0 0 15px rgba(57,255,20,0.3)',
          }}>
          {str.split('').map((ch, i) => (
            <span key={i} className="inline-block"
              style={{
                minWidth: ch === ',' ? '0.25em' : '0.55em',
                color: ch === ',' ? 'rgba(57,255,20,0.4)' : '#39FF14',
              }}>
              {ch}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      {!done && <div className="score-scanline" style={{ position: 'absolute', left: -20, right: -20, zIndex: 10 }} />}
      <div className="font-mono font-bold tabular-nums text-center whitespace-nowrap flex items-center justify-center"
        style={{
          fontSize: 'clamp(28px, 6vw, 42px)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.15))',
        }}>
        {str.split('').map((ch, i) => (
          <span key={i} className="inline-block"
            style={{
              minWidth: ch === ',' ? '0.25em' : '0.55em',
              background: ch === ',' ? 'none' : 'linear-gradient(180deg, #F2F0E8 0%, #C8B88A 100%)',
              WebkitBackgroundClip: ch === ',' ? 'none' : 'text',
              WebkitTextFillColor: ch === ',' ? 'initial' : 'transparent',
              color: ch === ',' ? 'rgba(255,255,255,0.2)' : '#F2F0E8',
            }}>
            {ch}
          </span>
        ))}
      </div>
      {done && total > 0 && <div className="absolute inset-0 score-flash pointer-events-none" style={{ filter: 'blur(20px)' }} />}
    </div>
  );
}

interface ChapterData {
  meta: ChapterMeta;
  songs: GameSong[];
  regularIds: string[];
  bonusCount: number;
  platinums: number;
  cleared: number;
  bonusUnlocked: boolean;
  unlocked: boolean;
}

export default function Campaign() {
  const [, setLocation] = useLocation();
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [totals, setTotals]     = useState({ score: 0, platinums: 0, cleared: 0 });
  const [loading, setLoading]   = useState(true);

  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAvant = getActiveTheme() === 'avant-garde';

  useEffect(() => {
    setTotals({ score: getTotalScore(), platinums: getTotalPlatinums(), cleared: getTotalCleared() });
    
    loadCatalog().then(catalog => {
      // 1. Calculate raw metadata stats for all chapters
      const data = CHAPTERS.map((meta, idx) => {
        const songs = catalog.filter(s => {
          if (!s.date) return false;
          const parts = s.date.split('-');
          return parts.length > 1 && parseInt(parts[1], 10) === meta.month;
        }).sort((a, b) => a.day - b.day);

        const regularIds = songs.length > 5 ? songs.slice(0, -5).map(s => s.id) : songs.map(s => s.id);
        const bonusCount = songs.length > 5 ? 5 : 0;
        const platinums  = getChapterPlatinums(regularIds);
        const cleared    = getChapterCleared(regularIds);
        
        return {
          meta,
          songs,
          regularIds,
          bonusCount,
          platinums,
          cleared,
          bonusUnlocked: platinums >= meta.platNeeded,
          unlocked: false, // will calculate iteratively next
        };
      });

      // 2. Compute progressive unlock state level-by-chapter
      // Chapter 1 is always unlocked.
      // Chapter N is unlocked if all regular songs in Chapter N-1 are cleared,
      // OR if they already have clears in Chapter N (for backward compatibility).
      data.forEach((ch, idx) => {
        if (idx === 0) {
          ch.unlocked = true;
        } else {
          const prevCh = data[idx - 1];
          const prevFinished = prevCh.cleared >= prevCh.regularIds.length;
          ch.unlocked = prevFinished || ch.cleared > 0;
        }
      });

      setChapters(data);
      setLoading(false);
    });
  }, []);

  // Track scroll offsets for parallax vectors calculations
  useEffect(() => {
    if (loading) return;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      setScrollTop(target.scrollTop);
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
  }, [loading]);

  const scrollToSection = (idx: number) => {
    const el = containerRef.current;
    if (el) {
      el.scrollTo({
        top: idx * el.clientHeight,
        behavior: 'smooth'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isAvant ? '#050505' : '#080808' }}>
        <div className="font-mono text-xs tracking-widest animate-pulse animate-duration-1000" style={{ color: isAvant ? '#39FF14' : 'rgba(255,255,255,0.3)' }}>LOADING CAMPAIGN INTEL...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full flex flex-col overflow-hidden select-none"
      style={{
        background: isAvant ? '#050505' : '#080808',
        position: 'relative'
      }}>

      {/* Top Header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-3.5 flex-shrink-0"
        style={{
          background: isAvant ? 'rgba(5,5,5,0.95)' : 'rgba(8,8,12,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: isAvant ? '1px solid rgba(57,255,20,0.2)' : '1px solid rgba(255,255,255,0.06)'
        }}>
        <button
          onClick={() => {
            audioManager.playSfx('tap_nav', 0.12);
            setLocation('/arcade');
          }}
          className={isAvant
            ? "font-mono text-[10px] tracking-[0.25em] text-[#39FF14] border border-[#39FF14]/30 px-4 py-1.5 hover:bg-[#39FF14]/10 transition-colors cursor-pointer"
            : "neon-btn-outline text-xs px-4 py-1.5 tracking-widest cursor-pointer"}
        >
          ← ARCADE
        </button>
        <div className="font-mono font-bold text-xs tracking-[0.5em] text-center" style={{ color: isAvant ? '#39FF14' : 'rgba(255,255,255,0.7)' }}>
          CAMPAIGN SECTORS
        </div>
        <button
          onClick={() => {
            audioManager.playSfx('tap_nav', 0.12);
            setLocation('/songs');
          }}
          className={isAvant
            ? "font-mono text-[10px] tracking-[0.25em] text-[#39FF14] border border-[#39FF14]/30 px-4 py-1.5 hover:bg-[#39FF14]/10 transition-colors cursor-pointer"
            : "neon-btn-outline text-xs px-4 py-1.5 tracking-widest cursor-pointer"}
        >
          AWARD PLAY →
        </button>
      </header>

      {/* Main Parallax Scrolling Container */}
      <div className="flex-1 w-full overflow-hidden relative">

        {/* Right Floating Dot Bullet Navigation */}
        <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4.5 z-30">
          {chapters.map((ch, idx) => {
            const active = Math.round(scrollTop / (containerHeight || 800)) === idx;
            return (
              <button
                key={idx}
                onClick={() => scrollToSection(idx)}
                className="w-3.5 h-3.5 rounded-full border transition-all relative flex items-center justify-center cursor-pointer"
                style={{
                  borderColor: active ? (isAvant ? '#39FF14' : ch.meta.dc) : 'rgba(255,255,255,0.15)',
                  backgroundColor: active ? (isAvant ? '#39FF14' : ch.meta.dc) : 'transparent',
                  boxShadow: active && !isAvant ? `0 0 10px ${ch.meta.dc}` : 'none'
                }}
                title={ch.meta.name}
              >
                {active && (
                  <span 
                    className="absolute -inset-1 rounded-full border animate-ping opacity-35"
                    style={{ borderColor: isAvant ? '#39FF14' : ch.meta.dc }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Scrolling Viewport */}
        <div
          ref={containerRef}
          id="campaign-scroll-container"
          className="w-full h-[calc(100vh-60px)] overflow-y-auto snap-y snap-mandatory scroll-smooth relative z-10 scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {chapters.map((ch, idx) => {
            const sectionTop = idx * containerHeight;
            const relativeScroll = scrollTop - sectionTop;

            // Compute parallax translations
            const titleY = relativeScroll * 0.45;
            const ringY  = relativeScroll * 0.25;
            const gridY  = relativeScroll * 0.12;

            const completed = ch.cleared >= ch.regularIds.length && ch.regularIds.length > 0;
            const unlocked = ch.unlocked;

            return (
              <section
                key={ch.meta.month}
                className="w-full h-full snap-start relative flex items-center justify-center overflow-hidden border-b border-white/5"
                style={{
                  background: isAvant 
                    ? '#050505'
                    : 'radial-gradient(circle at 50% 50%, #0c0d24 0%, #080808 100%)'
                }}
              >
                {/* 1. Background Giant Text Layer */}
                <div
                  className="absolute font-mono font-black select-none pointer-events-none text-[22vw] tracking-wider leading-none text-center"
                  style={{
                    transform: `translateY(${titleY}px)`,
                    color: isAvant ? 'rgba(57,255,20,0.015)' : `${ch.meta.dc}05`,
                  }}
                >
                  CH_{String(ch.meta.month).padStart(2, '0')}
                </div>

                {/* 2. Glowing Radial Light Layer */}
                <div
                  className="absolute w-[600px] h-[600px] rounded-full blur-[110px] pointer-events-none opacity-20"
                  style={{
                    background: `radial-gradient(circle, ${isAvant ? '#39FF14' : ch.meta.dc} 0%, transparent 70%)`,
                    transform: `translateY(${ringY}px)`,
                  }}
                />

                {/* 3. Tech Grid Background Layer */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: isAvant
                      ? "linear-gradient(rgba(57,255,20,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(57,255,20,0.012) 1px,transparent 1px)"
                      : "linear-gradient(rgba(255,255,255,0.008) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.008) 1px,transparent 1px)",
                    backgroundSize: "48px 48px",
                    transform: `translateY(${gridY}px)`,
                  }}
                />

                {/* 4. Glassmorphic Interaction Card */}
                <div 
                  className="relative z-10 w-full max-w-[450px] mx-4 p-8 border rounded-2xl backdrop-blur-xl bg-black/75 flex flex-col justify-between min-h-[350px] shadow-2xl transition-all duration-300 overflow-hidden"
                  style={{
                    borderColor: isAvant
                      ? 'rgba(57,255,20,0.2)'
                      : `${ch.meta.dc}22`
                  }}
                >
                  
                  {/* Blended Album Art Collage Background Layer */}
                  <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none z-0 opacity-20">
                    <div className="grid grid-cols-3 gap-1.5 h-full w-full p-3 rotate-6 scale-115">
                      {ch.songs.slice(0, 9).map((song, sIdx) => (
                        song.coverArt ? (
                          <div key={sIdx} className="relative aspect-square overflow-hidden rounded bg-zinc-900 border border-white/5 shadow-md">
                            <img 
                              src={song.coverArt} 
                              alt={song.title} 
                              className="w-full h-full object-cover filter brightness-[0.6] contrast-[1.1] grayscale" 
                            />
                          </div>
                        ) : null
                      ))}
                    </div>
                    {/* Radial dark mask to keep text foreground readable */}
                    <div 
                      className="absolute inset-0"
                      style={{
                        background: 'radial-gradient(circle at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.85) 75%, rgba(0,0,0,0.95) 100%)'
                      }}
                    />
                  </div>

                  {/* Title Info Block */}
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] font-bold tracking-[0.25em]" style={{ color: isAvant ? '#39FF14' : ch.meta.dc }}>
                        SECTOR_{String(ch.meta.month).padStart(2, '0')} //
                      </span>
                      
                      <div className="flex gap-2">
                        <span className="font-mono text-[8px] px-2 py-0.5 border"
                          style={{ 
                            color: isAvant ? '#39FF14' : ch.meta.dc, 
                            borderColor: isAvant ? 'rgba(57,255,20,0.3)' : `${ch.meta.dc}30`,
                            background: 'rgba(0,0,0,0.2)' 
                          }}>
                          {ch.meta.diff}
                        </span>
                        <span className="font-mono text-[8px] px-2 py-0.5 border border-white/5 text-zinc-500 uppercase">
                          {ch.meta.mood}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h2 className="font-mono font-black text-3xl uppercase tracking-wider text-white">
                        {ch.meta.name}
                      </h2>
                      <div className="font-mono text-[9px] text-zinc-500 mt-1 tracking-widest uppercase">
                        {ch.meta.sub}
                      </div>
                    </div>
                  </div>

                  {/* Node clear progress and lock screens */}
                  <div className="my-6 relative z-10">
                    {!unlocked ? (
                      <div className="p-4 border border-[#FF3800]/30 bg-[#FF3800]/05 font-mono text-xs">
                        <div className="flex items-center gap-2 text-[#FF3800] font-black uppercase mb-1">
                          <Lock size={12} />
                          SIGNAL BLOCKED
                        </div>
                        <div className="text-zinc-400 text-[9.5px] leading-relaxed uppercase">
                          Decode previous sector nodes to establish a stable neural connection to this frequency.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 font-mono">
                        {/* Clear Progress slider */}
                        <div>
                          <div className="flex justify-between text-[9px] text-zinc-400 mb-1.5 uppercase">
                            <span>Sector Decoded</span>
                            <span style={{ color: ch.cleared > 0 ? (isAvant ? '#39FF14' : ch.meta.dc) : 'rgba(255,255,255,0.2)' }}>
                              {ch.cleared} / {ch.regularIds.length} tracks
                            </span>
                          </div>
                          <div className="h-1 bg-zinc-950 flex overflow-hidden rounded-full border border-white/5">
                            <div
                              className="h-full transition-all duration-500 rounded-full"
                              style={{
                                width: `${(ch.cleared / (ch.regularIds.length || 1)) * 100}%`,
                                background: isAvant ? '#39FF14' : ch.meta.dc,
                                boxShadow: ch.cleared > 0 && !isAvant ? `0 0 10px ${ch.meta.dc}` : 'none'
                              }}
                            />
                          </div>
                        </div>

                        {/* Stats items grid */}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="p-2.5 border border-white/5 bg-zinc-950/40">
                            <div className="text-[7.5px] text-zinc-500 tracking-wider uppercase mb-0.5">PLATINUMS</div>
                            <div className="text-sm font-black text-[#39FF14]">
                              ✦ {ch.platinums}
                            </div>
                            <div className="text-[6.5px] text-zinc-500 uppercase">Needed: {ch.meta.platNeeded} PT</div>
                          </div>

                          <div className="p-2.5 border border-white/5 bg-zinc-950/40">
                            <div className="text-[7.5px] text-zinc-500 tracking-wider uppercase mb-0.5">BONUS STAGES</div>
                            <div className={`text-sm font-black ${ch.bonusUnlocked ? 'text-[#E5B800]' : 'text-zinc-600'}`}>
                              {ch.bonusUnlocked ? '★ UNLOCKED' : '🔒 LOCKED'}
                            </div>
                            <div className="text-[6.5px] text-zinc-500 uppercase">{ch.bonusCount} locked tracks</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Engage bar */}
                  <div className="relative z-10">
                    <button
                      disabled={!unlocked}
                      onClick={() => {
                        audioManager.playSfx("tap_nav", 0.18);
                        setLocation(`/chapter/${ch.meta.month}`);
                      }}
                      className={`w-full py-3.5 font-mono font-bold text-xs tracking-[0.25em] border transition-all uppercase flex items-center justify-center gap-2 cursor-pointer ${
                        unlocked
                          ? (isAvant
                            ? "border-[#39FF14] text-[#39FF14] hover:bg-[#39FF14]/10"
                            : "neon-btn text-white"
                          )
                          : "border-zinc-800 bg-zinc-950/20 text-zinc-600 cursor-not-allowed"
                      }`}
                    >
                      {unlocked ? (
                        <>
                          <Play size={10} className="fill-current" />
                          [ ENGAGE SECTOR ]
                        </>
                      ) : (
                        <>
                          <Lock size={10} />
                          [ CODES INSUFFICIENT ]
                        </>
                      )}
                    </button>
                  </div>

                </div>

              </section>
            );
          })}
        </div>

        {/* Global collector stats floating bottom navigation line */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-black/95 border border-white/5 backdrop-blur-xl py-2.5 px-6 rounded-full font-mono flex items-center gap-6 text-[8px] sm:text-[9px] tracking-widest text-zinc-400 uppercase shadow-2xl select-none whitespace-nowrap">
          <span>CLEARED: <strong className="text-white">{totals.cleared}</strong></span>
          <span className="w-1 h-1 rounded-full bg-white/25" />
          <span>PLATINUMS: <strong className="text-[#39FF14]">✦ {totals.platinums}</strong></span>
          <span className="w-1 h-1 rounded-full bg-white/25" />
          <span>TOTAL SCORE: <strong className="text-[#ffd700]">{totals.score.toLocaleString()}</strong></span>
        </div>

      </div>

    </div>
  );
}
