import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentDay } from '../utils/dayCalc';
import { 
  pickBombshellArtwork, 
  getBombshellCoverCandidates, 
  DEFAULT_BOMBSHELL_PACK_COVER 
} from '../utils/bombshellCards';
import MainBrandLogo from './MainBrandLogo';
import FeatureReel from './showcase/FeatureReel';
import { audioManager } from '../game/audio';

const ROTATING_PROMPTS = [
  'PRESS START',
  'PRESS ANY KEY',
  'LEFT MOUSE CLICK',
  'TOUCH THE SCREEN TO START',
];

const IDLE_ATTRACT_TIMEOUT_MS = 8000;

interface ArcadeSplashScreenProps {
  onStart: () => void;
}

export default function ArcadeSplashScreen({ onStart }: ArcadeSplashScreenProps) {
  const [textIndex, setTextIndex] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isAttractMode, setIsAttractMode] = useState(false);

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
            {isAttractMode ? 'ATTRACT_MODE // GAMEPLAY_REEL' : 'ARCADE_STANDBY // TITLE'}
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
              <span>▶ HOW IT PLAYS</span>
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
            <span>GAMEPLAY DEMO STARTS IN 8S</span>
          </div>
        </motion.div>
      ) : (
        /* ATTRACT MODE: LIVE GAMEPLAY REEL, ONE DEMO PER FEATURE */
        <FeatureReel key="attract-reel" startLabel={ROTATING_PROMPTS[textIndex]} />
      )}

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
