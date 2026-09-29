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

interface ArcadeSplashScreenProps {
  onStart: () => void;
}

export default function ArcadeSplashScreen({ onStart }: ArcadeSplashScreenProps) {
  const [textIndex, setTextIndex] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const [dayNumber] = useState(() => getCurrentDay());
  const [pickedCover] = useState(() => pickBombshellArtwork(dayNumber));
  const [candidateUrls, setCandidateUrls] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [candidateIdx, setCandidateIdx] = useState(0);
  const hasTriggeredRef = useRef(false);

  // Initialize candidates & cover URL on mount (fresh random pull every time!)
  useEffect(() => {
    const urls = getBombshellCoverCandidates(dayNumber, pickedCover.fileName);
    setCandidateUrls(urls);
    setCoverUrl(urls[0] || pickedCover.coverUrl || DEFAULT_BOMBSHELL_PACK_COVER);
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
      onStart();
    }, 450);
  }, [isDismissing, onStart]);

  // Window keydown listener: any key triggers start
  useEffect(() => {
    const onKeyDown = (_e: KeyboardEvent) => {
      handleEngage();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleEngage]);

  // Gamepad button polling for "PRESS START"
  useEffect(() => {
    let animId: number;
    const pollGamepad = () => {
      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        const gamepads = navigator.getGamepads();
        for (const gp of gamepads) {
          if (gp && gp.buttons.some((b) => b.pressed)) {
            handleEngage();
            return;
          }
        }
      }
      animId = requestAnimationFrame(pollGamepad);
    };
    animId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animId);
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
      `}</style>

      {/* Faint Bombshell Cover Behind Everything */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-black">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={`Day ${dayNumber} Bombshell`}
            onError={handleCoverError}
            className="w-full h-full object-cover object-center opacity-20 sm:opacity-25 filter contrast-110 brightness-90 arcade-drift"
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

      {/* Header HUD: Top Bar & Skip Button */}
      <div className="w-full flex items-center justify-between z-20 relative">
        <div className="flex items-center gap-2 font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-white/40">
          <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-ping" />
          <span>ARCADE_ATTRACT // DAY {String(dayNumber).padStart(3, '0')}</span>
        </div>

        {/* Skip button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleEngage();
          }}
          className="group flex items-center gap-1.5 px-3 py-1 font-mono text-[9px] sm:text-[10px] tracking-widest text-zinc-400 hover:text-white bg-black/60 hover:bg-black/90 border border-white/15 hover:border-[#39FF14] rounded-sm transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow-[0_0_12px_rgba(0,0,0,0.8)]"
          style={{
            clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
          }}
        >
          <span>SKIP</span>
          <span className="text-[#39FF14] group-hover:translate-x-0.5 transition-transform">➔</span>
        </button>
      </div>

      {/* Center: Brand Logo Fading in from Dark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
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
      </motion.div>

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
