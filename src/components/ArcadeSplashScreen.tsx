import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentDay } from '../utils/dayCalc';
import { 
  pickBombshellArtwork, 
  getBombshellCoverCandidates, 
  DEFAULT_BOMBSHELL_PACK_COVER 
} from '../utils/bombshellCards';
import MainBrandLogo from './MainBrandLogo';
import { audioManager } from '../game/audio';

const ROTATING_PROMPTS = [
  'PRESS START',
  'PRESS ANY KEY',
  'LEFT MOUSE CLICK',
  'TOUCH THE SCREEN TO START',
];

const LORE_SLIDES = [
  {
    id: '365_days',
    badge: 'PROTOCOL // 365 TRANSMISSIONS',
    tabLabel: '365 DAYS',
    title: '365 DAYS OF LIGHT & DARK',
    subtitle: 'THE DUAL POLARITY SONIC ODYSSEY',
    accentColor: '#FFB800',
    glowColor: 'rgba(255, 184, 0, 0.4)',
  },
  {
    id: 'th3scr1b3',
    badge: 'CREATOR ARCHIVE // THE ANONYMOUS SIGHT',
    tabLabel: 'TH3SCR1B3',
    title: 'TH3SCR1B3',
    subtitle: 'CRYPTOGRAPHIC SOUND ARCHITECT & SONIC POET',
    accentColor: '#00F0FF',
    glowColor: 'rgba(0, 240, 255, 0.4)',
  },
  {
    id: 'pim_engine',
    badge: 'RHYTHM ENGINE // HARDWARE ACCELERATED',
    tabLabel: 'PIM ENGINE',
    title: 'PIM : TH3V4ULT',
    subtitle: 'POETRY IN MOTION // 3-LANE RHYTHMIC KINETICS',
    accentColor: '#39FF14',
    glowColor: 'rgba(57, 255, 20, 0.4)',
  },
];

const IDLE_ATTRACT_TIMEOUT_MS = 8000;
const SLIDE_DURATION_MS = 6500;

interface ArcadeSplashScreenProps {
  onStart: () => void;
}

export default function ArcadeSplashScreen({ onStart }: ArcadeSplashScreenProps) {
  const [textIndex, setTextIndex] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isAttractMode, setIsAttractMode] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const [dayNumber] = useState(() => {
    try {
      return getCurrentDay();
    } catch {
      return 1;
    }
  });

  const [pickedCover] = useState(() => {
    try {
      return pickBombshellArtwork(dayNumber);
    } catch {
      return { fileName: 'default.jpg', coverUrl: DEFAULT_BOMBSHELL_PACK_COVER, isLB: false };
    }
  });

  const [candidateUrls, setCandidateUrls] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [candidateIdx, setCandidateIdx] = useState(0);

  const hasTriggeredRef = useRef(false);
  const idleTimerRef = useRef<any>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Initialize candidates & cover URL on mount (fresh random pull every time!)
  useEffect(() => {
    try {
      const fileName = pickedCover?.fileName || '';
      const urls = getBombshellCoverCandidates(dayNumber, fileName);
      setCandidateUrls(urls);
      setCoverUrl(urls[0] || pickedCover?.coverUrl || DEFAULT_BOMBSHELL_PACK_COVER);
    } catch (err) {
      console.warn('[ArcadeSplash] Failed to load cover candidates:', err);
      setCoverUrl(DEFAULT_BOMBSHELL_PACK_COVER);
    }
  }, [dayNumber, pickedCover]);

  // Handle fallback if cover candidate fails to load
  const handleCoverError = () => {
    const nextIdx = candidateIdx + 1;
    if (nextIdx < candidateUrls.length) {
      setCandidateIdx(nextIdx);
      setCoverUrl(candidateUrls[nextIdx]);
    } else {
      setCoverUrl(DEFAULT_BOMBSHELL_PACK_COVER);
    }
  };

  // Cycle rotating arcade text
  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % ROTATING_PROMPTS.length);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  // Universal engage handler
  const handleEngage = useCallback(async () => {
    if (hasTriggeredRef.current || isDismissing) return;
    hasTriggeredRef.current = true;
    setIsDismissing(true);

    try {
      await audioManager.ensureReady();
      audioManager.playSfx('menu_confirm', 0.6);
    } catch {
      // Audio context unlock fallback
    }

    // Smooth exit transition
    setTimeout(() => {
      try {
        onStart();
      } catch (err) {
        console.error('[ArcadeSplash] onStart error:', err);
      }
    }, 450);
  }, [isDismissing, onStart]);

  // Idle timer to auto-activate Attract Mode
  const resetIdleTimer = useCallback(() => {
    if (isAttractMode) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsAttractMode(true);
    }, IDLE_ATTRACT_TIMEOUT_MS);
  }, [isAttractMode]);

  useEffect(() => {
    resetIdleTimer();

    const handleThrottledActivity = () => {
      const now = Date.now();
      // Throttle activity checks to at most once per 300ms to avoid re-render thrashing
      if (now - lastActivityRef.current > 300) {
        lastActivityRef.current = now;
        if (!isAttractMode) {
          resetIdleTimer();
        }
      }
    };

    window.addEventListener('mousemove', handleThrottledActivity, { passive: true });
    window.addEventListener('scroll', handleThrottledActivity, { passive: true });
    window.addEventListener('touchstart', handleThrottledActivity, { passive: true });

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', handleThrottledActivity);
      window.removeEventListener('scroll', handleThrottledActivity);
      window.removeEventListener('touchstart', handleThrottledActivity);
    };
  }, [isAttractMode, resetIdleTimer]);

  // Clean, zero-CPU slide cycling in Attract Mode
  useEffect(() => {
    if (!isAttractMode) return;

    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % LORE_SLIDES.length);
    }, SLIDE_DURATION_MS);

    return () => clearInterval(interval);
  }, [isAttractMode]);

  // Window keydown listener: any key triggers start
  useEffect(() => {
    const onKeyDown = () => {
      handleEngage();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleEngage]);

  // Safe Gamepad button polling for "PRESS START" (with indexed loop & try-catch)
  useEffect(() => {
    let animId: number;
    let isActive = true;

    const pollGamepad = () => {
      if (!isActive) return;

      try {
        if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
          const gamepads = navigator.getGamepads();
          if (gamepads && typeof gamepads.length === 'number') {
            for (let i = 0; i < gamepads.length; i++) {
              const gp = gamepads[i];
              if (gp && gp.buttons && typeof gp.buttons.length === 'number') {
                for (let b = 0; b < gp.buttons.length; b++) {
                  if (gp.buttons[b]?.pressed) {
                    handleEngage();
                    return;
                  }
                }
              }
            }
          }
        }
      } catch {
        // Disallowed by permissions policy or unsupported browser context
      }

      animId = requestAnimationFrame(pollGamepad);
    };

    animId = requestAnimationFrame(pollGamepad);
    return () => {
      isActive = false;
      cancelAnimationFrame(animId);
    };
  }, [handleEngage]);

  const currentSlideData = LORE_SLIDES[activeSlide] ?? LORE_SLIDES[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isDismissing ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: isDismissing ? 0.45 : 1.2, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleEngage}
      className="fixed inset-0 z-[99999] bg-[#050402] flex flex-col items-center justify-between select-none overflow-hidden cursor-pointer"
      style={{
        paddingTop: 'calc(var(--fc-safe-area-top, 0px) + env(safe-area-inset-top, 0px) + 1.2rem)',
        paddingBottom: 'calc(var(--fc-safe-area-bottom, 0px) + env(safe-area-inset-bottom, 0px) + 1.5rem)',
        paddingLeft: 'calc(var(--fc-safe-area-left, 0px) + 1.5rem)',
        paddingRight: 'calc(var(--fc-safe-area-right, 0px) + 1.5rem)',
      }}
    >
      <style>{`
        @keyframes arcadeSlowBlink {
          0%, 100% {
            opacity: 1;
            text-shadow: 0 0 10px rgba(57, 255, 20, 0.8), 0 0 22px rgba(57, 255, 20, 0.45);
          }
          50% {
            opacity: 0.18;
            text-shadow: none;
          }
        }
        .arcade-slow-blink {
          animation: arcadeSlowBlink 1.4s ease-in-out infinite;
        }
        @keyframes subtleDrift {
          0%, 100% {
            transform: scale(1.04) translate(0px, 0px);
          }
          50% {
            transform: scale(1.08) translate(-4px, -6px);
          }
        }
        .arcade-drift {
          animation: subtleDrift 20s ease-in-out infinite;
        }
        @keyframes eqBarPulse {
          0%, 100% { height: 18%; }
          50% { height: 95%; }
        }
        @keyframes laneNoteFlow {
          0% { transform: translateY(-30px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(120px); opacity: 0; }
        }
        @keyframes cornerKioskPulse {
          0%, 100% {
            border-color: rgba(57, 255, 20, 0.45);
            box-shadow: 0 0 20px rgba(57, 255, 20, 0.25);
          }
          50% {
            border-color: rgba(57, 255, 20, 0.85);
            box-shadow: 0 0 35px rgba(57, 255, 20, 0.5);
          }
        }
        .corner-kiosk-border {
          animation: cornerKioskPulse 3s ease-in-out infinite;
        }
      `}</style>

      {/* Faint Bombshell Cover Behind Everything */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-black">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={`Day ${dayNumber} Bombshell`}
            onError={handleCoverError}
            className={`w-full h-full object-cover object-center filter contrast-110 brightness-90 arcade-drift transition-opacity duration-1000 ${
              isAttractMode ? 'opacity-15' : 'opacity-20 sm:opacity-25'
            }`}
          />
        )}
        {/* Retro scanlines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.5) 50%)',
            backgroundSize: '100% 4px',
          }}
        />
        {/* Heavy Vignette & Edge Shadow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at center, rgba(5,4,2,0.3) 0%, rgba(5,4,2,0.75) 60%, #050402 100%)',
          }}
        />
      </div>

      {/* Header HUD: Top Bar & Skip / Attract Controls */}
      <div className="w-full flex items-center justify-between z-20 relative">
        <div className="flex items-center gap-2 font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-white/50">
          <span
            className={`w-2 h-2 rounded-full ${
              isAttractMode ? 'bg-[#00F0FF] animate-ping' : 'bg-[#39FF14] animate-ping'
            }`}
          />
          <span className="font-bold">
            {isAttractMode ? 'ATTRACT_MODE // LORE_REEL' : 'ARCADE_STANDBY // TITLE'}
          </span>
          <span className="text-white/30 hidden sm:inline">|</span>
          <span className="text-white/40 hidden sm:inline">DAY {String(dayNumber).padStart(3, '0')}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Attract Mode Toggle Button */}
          {!isAttractMode ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAttractMode(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1 font-mono text-[9px] sm:text-[10px] tracking-widest text-[#00F0FF] hover:text-white bg-[#00F0FF]/10 hover:bg-[#00F0FF]/25 border border-[#00F0FF]/30 hover:border-[#00F0FF] rounded-sm transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow-[0_0_12px_rgba(0,240,255,0.2)]"
            >
              <span>⚡ LORE REEL</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAttractMode(false);
                resetIdleTimer();
              }}
              className="flex items-center gap-1.5 px-3 py-1 font-mono text-[9px] sm:text-[10px] tracking-widest text-zinc-300 hover:text-white bg-black/60 hover:bg-black/90 border border-white/20 hover:border-white/50 rounded-sm transition-all cursor-pointer backdrop-blur-md active:scale-95"
            >
              <span>✕ TITLE SCREEN</span>
            </button>
          )}

          {/* Skip / Start button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleEngage();
            }}
            className="group flex items-center gap-1.5 px-3 py-1 font-mono text-[9px] sm:text-[10px] tracking-widest text-zinc-300 hover:text-white bg-black/60 hover:bg-black/90 border border-white/15 hover:border-[#39FF14] rounded-sm transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow-[0_0_12px_rgba(0,0,0,0.8)]"
            style={{
              clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
            }}
          >
            <span>START GAME</span>
            <span className="text-[#39FF14] group-hover:translate-x-0.5 transition-transform">➔</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Standard Title Screen vs Attract Mode */}
      {!isAttractMode ? (
        /* CENTER TITLE SCREEN (STANDARD MODE) */
        <motion.div
          key="standard-title"
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -20 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center justify-center text-center z-20 my-auto py-6"
        >
          <div className="pointer-events-none">
            <MainBrandLogo size="hero" showGlow={true} interactive={false} priority={true} />
          </div>

          <div className="mt-3 sm:mt-5 font-mono text-[9px] sm:text-[11px] md:text-xs tracking-[0.55em] uppercase text-white/50 text-center font-bold">
            POETRY IN MOTION // 365 DAYS OF LIGHT & DARK
          </div>

          {/* Rotating Slow Blinking Arcade Text */}
          <div className="h-14 flex items-center justify-center mt-6 sm:mt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={textIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="font-mono text-sm sm:text-base md:text-xl font-black tracking-[0.35em] uppercase text-[#39FF14] arcade-slow-blink select-none text-center px-4"
              >
                {ROTATING_PROMPTS[textIndex]}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="font-mono text-[8px] sm:text-[9px] tracking-[0.35em] text-white/30 uppercase mt-2">
            // CLICK ANYWHERE TO INITIALIZE AUDIO & SYSTEM //
          </div>

          <div className="mt-5 flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-white/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse" />
            <span>IDLE DEMO AUTO-STARTS IN 8S</span>
          </div>
        </motion.div>
      ) : (
        /* ATTRACT MODE: ANIMATED LORE REEL ON MAIN STAGE */
        <motion.div
          key="attract-reel"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl z-20 my-auto py-2 px-2 sm:px-6 flex flex-col justify-center"
        >
          {/* Reel Nav Tabs & Slide Progress Bar */}
          <div className="w-full flex flex-col gap-2 mb-4 sm:mb-6">
            <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2">
              <div className="flex items-center gap-1.5 sm:gap-3">
                {LORE_SLIDES.map((slide, idx) => {
                  const isActive = idx === activeSlide;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlide(idx);
                      }}
                      className={`px-2.5 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs tracking-wider uppercase rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-white/15 text-white border border-white/30 font-bold shadow-[0_0_15px_rgba(255,255,255,0.15)]'
                          : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: isActive ? slide.accentColor : 'rgba(255,255,255,0.2)',
                        }}
                      />
                      <span>
                        0{idx + 1} // {slide.tabLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Prev / Next controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide((prev) => (prev - 1 + LORE_SLIDES.length) % LORE_SLIDES.length);
                  }}
                  className="w-7 h-7 flex items-center justify-center font-mono text-xs text-white/50 hover:text-white bg-black/50 hover:bg-black/80 border border-white/15 hover:border-white/40 rounded transition-all"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide((prev) => (prev + 1) % LORE_SLIDES.length);
                  }}
                  className="w-7 h-7 flex items-center justify-center font-mono text-xs text-white/50 hover:text-white bg-black/50 hover:bg-black/80 border border-white/15 hover:border-white/40 rounded transition-all"
                >
                  ▶
                </button>
              </div>
            </div>

            {/* Hardware-Accelerated Progress Bar */}
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                key={`progress-${activeSlide}`}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: SLIDE_DURATION_MS / 1000, ease: 'linear' }}
                className="h-full"
                style={{
                  backgroundColor: currentSlideData?.accentColor || '#39FF14',
                  boxShadow: `0 0 10px ${currentSlideData?.accentColor || '#39FF14'}`,
                }}
              />
            </div>
          </div>

          {/* Active Slide Body */}
          <div className="relative min-h-[340px] sm:min-h-[380px] bg-black/60 border border-white/15 rounded-xl p-4 sm:p-7 backdrop-blur-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <AnimatePresence mode="wait">
              {/* SLIDE 0: 365 DAYS OF LIGHT & DARK */}
              {activeSlide === 0 && (
                <motion.div
                  key="slide-365"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <div className="font-mono text-[9px] sm:text-[10px] tracking-[0.3em] uppercase text-[#FFB800] font-bold">
                        {LORE_SLIDES[0].badge}
                      </div>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-white tracking-wider mt-0.5">
                        {LORE_SLIDES[0].title}
                      </h2>
                      <div className="font-mono text-[10px] sm:text-xs text-white/50 tracking-widest uppercase">
                        {LORE_SLIDES[0].subtitle}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded bg-[#FFB800]/10 border border-[#FFB800]/30 font-mono text-[10px] sm:text-xs text-[#FFB800] font-bold">
                      DAY {dayNumber} / 365 UNLOCKED
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans font-light">
                    A continuous year-long audiovisual chronicle descending through the electromagnetic spectrum. 
                    Every single dawn decrypts a new sonic gauntlet, juxtaposing solar harmonic clarity against midnight distortion. 
                    Every day of the year brings a curated song transmission, exclusive bombshell anime cover artwork, and competitive rhythm leaderboards.
                  </p>

                  {/* Year Progress Bar Visualizer */}
                  <div className="bg-black/50 p-3 sm:p-4 rounded-lg border border-white/10 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono">
                      <span className="text-white/60">365-DAY CHRONICLE CADENCE</span>
                      <span className="text-[#FFB800] font-bold">
                        {Math.round((dayNumber / 365) * 100)}% COMPLETE
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-[#FFB800] via-[#FF5500] to-[#FF2244]"
                        style={{ width: `${Math.max(4, (dayNumber / 365) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-mono text-white/40">
                      <span>DAY 001: GENESIS TRANSMISSION</span>
                      <span>{365 - dayNumber} TRANSMISSIONS REMAINING</span>
                    </div>
                  </div>

                  {/* Dual Polarity Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-center gap-2 font-mono text-[10px] sm:text-xs text-amber-400 font-bold uppercase mb-1">
                        <span>☀️ SOLAR SPECTRUM (LIGHT)</span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed">
                        Euphoric synth arpeggios, crisp high-frequency transients, and golden card rarities designed for morning clarity and daytime velocity.
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                      <div className="flex items-center gap-2 font-mono text-[10px] sm:text-xs text-indigo-400 font-bold uppercase mb-1">
                        <span>🌙 LUNAR SPECTRUM (DARK)</span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed">
                        Deep 808 sub-bass resonance, glitch breakcore, and industrial overdrive tuned for night sessions and high-intensity reflex challenges.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SLIDE 1: TH3SCR1B3 */}
              {activeSlide === 1 && (
                <motion.div
                  key="slide-th3scr1b3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <div className="font-mono text-[9px] sm:text-[10px] tracking-[0.3em] uppercase text-[#00F0FF] font-bold">
                        {LORE_SLIDES[1].badge}
                      </div>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-white tracking-wider mt-0.5">
                        {LORE_SLIDES[1].title}
                      </h2>
                      <div className="font-mono text-[10px] sm:text-xs text-white/50 tracking-widest uppercase">
                        {LORE_SLIDES[1].subtitle}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded bg-[#00F0FF]/10 border border-[#00F0FF]/30 font-mono text-[10px] sm:text-xs text-[#00F0FF] font-bold">
                      PRODUCER // POET // ARCHITECT
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans font-light">
                    The anonymous sonic architect operating at the bleeding-edge of technical breakcore, analog modular synthesis, and brutalist poetry. 
                    From encrypted vinyl pressings to high-BPM digital transmissions, th3scr1b3 engineers hyper-kinetic rhythms engineered to test the limits of human reflexes.
                  </p>

                  {/* Equalizer Visualizer & Specs */}
                  <div className="bg-black/50 p-3 sm:p-4 rounded-lg border border-white/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between font-mono text-[9px] sm:text-[10px] text-white/50">
                      <span>AUDIO OSCILLOSCOPE // 24-BIT 96kHz LOSSLESS</span>
                      <span className="text-[#00F0FF]">SPECTRUM ACTIVE</span>
                    </div>

                    {/* Animated EQ Bars */}
                    <div className="h-12 flex items-end justify-between gap-1 sm:gap-1.5 px-2">
                      {[35, 65, 85, 45, 95, 75, 40, 90, 60, 100, 70, 50, 80, 65, 90, 45, 85, 60, 95, 55, 70, 85, 40, 75].map(
                        (h, idx) => (
                          <div
                            key={idx}
                            className="flex-1 bg-gradient-to-t from-[#00F0FF]/40 to-[#00F0FF] rounded-t-sm"
                            style={{
                              height: `${h}%`,
                              animation: `eqBarPulse ${0.8 + (idx % 7) * 0.15}s ease-in-out infinite alternate`,
                              animationDelay: `${(idx * 0.05).toFixed(2)}s`,
                            }}
                          />
                        )
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-center font-mono">
                      <div className="p-1.5 rounded bg-white/5">
                        <div className="text-[8px] text-white/40">VELOCITY</div>
                        <div className="text-[10px] sm:text-xs text-[#00F0FF] font-bold">120 - 220+ BPM</div>
                      </div>
                      <div className="p-1.5 rounded bg-white/5">
                        <div className="text-[8px] text-white/40">ACOUSTICS</div>
                        <div className="text-[10px] sm:text-xs text-white font-bold">MODULAR DUALITY</div>
                      </div>
                      <div className="p-1.5 rounded bg-white/5">
                        <div className="text-[8px] text-white/40">VINYL CUTS</div>
                        <div className="text-[10px] sm:text-xs text-white font-bold">MASTER DUBPLATES</div>
                      </div>
                      <div className="p-1.5 rounded bg-white/5">
                        <div className="text-[8px] text-white/40">PROVENANCE</div>
                        <div className="text-[10px] sm:text-xs text-[#39FF14] font-bold">VAULT ARCHIVED</div>
                      </div>
                    </div>
                  </div>

                  {/* Scribe's Motto */}
                  <div className="p-2.5 sm:p-3 rounded bg-white/5 border border-white/10 font-mono text-[10px] sm:text-xs text-zinc-300 italic text-center">
                    &ldquo;Poetry is rhythm slowed to the speed of consciousness. Speed is poetry pushed past the sound barrier.&rdquo;
                  </div>
                </motion.div>
              )}

              {/* SLIDE 2: PIM (POETRY IN MOTION) */}
              {activeSlide === 2 && (
                <motion.div
                  key="slide-pim"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <div className="font-mono text-[9px] sm:text-[10px] tracking-[0.3em] uppercase text-[#39FF14] font-bold">
                        {LORE_SLIDES[2].badge}
                      </div>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-white tracking-wider mt-0.5">
                        {LORE_SLIDES[2].title}
                      </h2>
                      <div className="font-mono text-[10px] sm:text-xs text-white/50 tracking-widest uppercase">
                        {LORE_SLIDES[2].subtitle}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded bg-[#39FF14]/10 border border-[#39FF14]/30 font-mono text-[10px] sm:text-xs text-[#39FF14] font-bold">
                      3-LANE // DSP CROSSOVER
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans font-light">
                    A hyper-accurate 3-lane rhythm gaming engine driven by real-time Web Audio DSP crossover filters. 
                    Isolate Bass, Mid, and High frequency bands with sub-buffer accuracy. Collect song cards, fuse duplicates in The Forge, and ignite $V⚡ Sparks on Base EVM.
                  </p>

                  {/* 3-Lane Kinetic Highway Preview */}
                  <div className="grid grid-cols-3 gap-2 bg-black/60 p-3 rounded-lg border border-white/10">
                    <div className="flex flex-col items-center gap-1.5 p-2 rounded bg-cyan-950/20 border border-cyan-500/30 overflow-hidden relative h-24">
                      <span className="font-mono text-[9px] sm:text-[10px] text-cyan-400 font-bold">LANE 1 // LOW</span>
                      <span className="text-[8px] font-mono text-white/40">20 - 250 Hz</span>
                      <div className="w-8 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_#00F0FF] absolute" style={{ animation: 'laneNoteFlow 1.6s ease-in infinite' }} />
                      <div className="w-full h-1 bg-cyan-400/30 absolute bottom-2" />
                    </div>

                    <div className="flex flex-col items-center gap-1.5 p-2 rounded bg-emerald-950/20 border border-emerald-500/30 overflow-hidden relative h-24">
                      <span className="font-mono text-[9px] sm:text-[10px] text-[#39FF14] font-bold">LANE 2 // MID</span>
                      <span className="text-[8px] font-mono text-white/40">250 - 4000 Hz</span>
                      <div className="w-8 h-2 bg-[#39FF14] rounded-full shadow-[0_0_10px_#39FF14] absolute" style={{ animation: 'laneNoteFlow 1.6s ease-in infinite 0.5s' }} />
                      <div className="w-full h-1 bg-[#39FF14]/30 absolute bottom-2" />
                    </div>

                    <div className="flex flex-col items-center gap-1.5 p-2 rounded bg-fuchsia-950/20 border border-fuchsia-500/30 overflow-hidden relative h-24">
                      <span className="font-mono text-[9px] sm:text-[10px] text-fuchsia-400 font-bold">LANE 3 // HIGH</span>
                      <span className="text-[8px] font-mono text-white/40">4k - 20k Hz</span>
                      <div className="w-8 h-2 bg-fuchsia-400 rounded-full shadow-[0_0_10px_#f43f5e] absolute" style={{ animation: 'laneNoteFlow 1.6s ease-in infinite 1.0s' }} />
                      <div className="w-full h-1 bg-fuchsia-400/30 absolute bottom-2" />
                    </div>
                  </div>

                  {/* Card Forge Ladder */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 p-2.5 rounded bg-white/5 border border-white/10 font-mono text-[8px] sm:text-[9px]">
                    <span className="text-white/40">FORGE RARITY LADDER:</span>
                    <span className="px-2 py-0.5 rounded bg-zinc-700/50 text-zinc-300">COMMON</span>
                    <span className="text-white/20">➔</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400">UNCOMMON</span>
                    <span className="text-white/20">➔</span>
                    <span className="px-2 py-0.5 rounded bg-blue-900/50 text-blue-400">RARE</span>
                    <span className="text-white/20">➔</span>
                    <span className="px-2 py-0.5 rounded bg-purple-900/50 text-purple-400">EPIC</span>
                    <span className="text-white/20">➔</span>
                    <span className="px-2 py-0.5 rounded bg-amber-900/50 text-amber-400">LEGENDARY</span>
                    <span className="text-white/20">➔</span>
                    <span className="px-2 py-0.5 rounded bg-rose-900/50 text-rose-400 font-bold">MYTHIC</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* MINIMIZED CORNER KIOSK ("PRESS START") IN ATTRACT MODE */}
      <AnimatePresence>
        {isAttractMode && (
          <motion.div
            key="corner-kiosk"
            initial={{ opacity: 0, scale: 0.75, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 30 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => {
              e.stopPropagation();
              handleEngage();
            }}
            className="fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-30 flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-[#050402]/95 backdrop-blur-xl border corner-kiosk-border cursor-pointer group shadow-[0_0_35px_rgba(57,255,20,0.3)] hover:scale-105 active:scale-95 transition-transform max-w-[210px] sm:max-w-[260px]"
          >
            {/* Corner Badge Header */}
            <div className="w-full flex items-center justify-between text-[8px] sm:text-[9px] font-mono uppercase text-white/50 border-b border-white/10 pb-1.5">
              <span className="flex items-center gap-1.5 text-[#39FF14]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-ping" />
                <span>FREE PLAY</span>
              </span>
              <span>CREDIT 99</span>
            </div>

            {/* Mini Brand Logo */}
            <div className="pointer-events-none scale-75 sm:scale-85 my-0.5">
              <MainBrandLogo size="nav" showGlow={false} interactive={false} />
            </div>

            {/* Blinking Rotating Arcade Prompt */}
            <div className="w-full text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={textIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="font-mono text-xs sm:text-sm font-black tracking-widest uppercase text-[#39FF14] arcade-slow-blink"
                >
                  {ROTATING_PROMPTS[textIndex]}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Click to start CTA button */}
            <div className="w-full py-1 px-2 rounded bg-[#39FF14]/15 border border-[#39FF14]/40 text-[#39FF14] group-hover:bg-[#39FF14] group-hover:text-black font-mono text-[9px] sm:text-[10px] font-bold text-center tracking-wider transition-all flex items-center justify-center gap-1">
              <span>TAP TO START</span>
              <span>➔</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer HUD: Coin & System Info */}
      <div className="w-full flex items-center justify-between font-mono text-[8px] sm:text-[9px] tracking-[0.3em] uppercase text-white/30 z-20 relative border-t border-white/5 pt-2">
        <div className="flex items-center gap-3">
          <span>CREDIT 99</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">FREE PLAY MODE</span>
        </div>
        <div className="flex items-center gap-3 text-right">
          <span className="hidden sm:inline">AUDIO ENGINE // ARMED</span>
          <span className="text-[#39FF14]/60">ONLINE</span>
        </div>
      </div>
    </motion.div>
  );
}
