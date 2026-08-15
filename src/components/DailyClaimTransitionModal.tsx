import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Sparkles, ShieldCheck, Zap, Disc, CheckCircle2, ChevronRight } from 'lucide-react';
import { useSmartCoverArt } from '../utils/rarityArtwork';
import { audioManager } from '../game/audio';

interface DailyClaimTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: number;
  songTitle?: string;
  artist?: string;
  bpm?: number;
  coverArt?: string;
  claimNumber?: number;
  onStartGame: () => void;
}

export default function DailyClaimTransitionModal({
  isOpen,
  onClose,
  day,
  songTitle = "Today's Track",
  artist = 'th3scr1b3',
  bpm = 120,
  coverArt,
  claimNumber = 1,
  onStartGame,
}: DailyClaimTransitionModalProps) {
  const [countdown, setCountdown] = useState(4);
  const { src: displayCover, handleError: handleCoverError } = useSmartCoverArt(coverArt, 'common');

  useEffect(() => {
    if (!isOpen) {
      setCountdown(4);
      return;
    }

    audioManager.playSfx('open_chest', 0.8);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onStartGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onStartGame]);

  if (!isOpen) return null;

  const formattedClaimNum = String(claimNumber).padStart(3, '0');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-xl"
          onClick={onClose}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-md bg-[#0c0a09] border-2 border-[#ff3800]/40 rounded-2xl p-6 sm:p-8 shadow-[0_0_80px_rgba(255,56,0,0.25)] text-center overflow-hidden"
        >
          {/* Cyber scanlines overlay */}
          <div className="absolute inset-0 scanlines opacity-10 pointer-events-none" />

          {/* Top ambient glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#ff3800]/20 blur-3xl rounded-full pointer-events-none" />

          {/* Protocol Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff3800]/10 border border-[#ff3800]/30 text-[#ff3800] text-[10px] font-mono font-bold tracking-widest uppercase mb-4 shadow-[0_0_12px_rgba(255,56,0,0.2)]">
            <Sparkles size={12} className="animate-spin" style={{ animationDuration: '4s' }} />
            <span>DAILY DROP CLAIM PROTOCOL</span>
          </div>

          {/* Big Bold Serial Number Highlight */}
          <div className="space-y-1 mb-6">
            <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-white/50">
              YOU ARE COLLECTOR
            </p>
            <h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-[#ffd700] to-[#ff3800] drop-shadow-[0_2px_10px_rgba(255,215,0,0.3)]">
              NUMBER #{formattedClaimNum}
            </h2>
            <p className="text-xs font-mono font-bold text-[#ffd700] tracking-wide uppercase">
              TO CLAIM TODAY'S CARD
            </p>
            <p className="text-[10px] font-mono text-white/40">
              [ EDITION #{formattedClaimNum} OF 100 • DAY {day} ARCHIVE ]
            </p>
          </div>

          {/* Card Picture Preview Container */}
          <div className="relative mx-auto w-40 sm:w-48 aspect-[3/4] mb-6 rounded-xl overflow-hidden border-2 border-[#ffd700]/40 shadow-[0_0_30px_rgba(255,215,0,0.2)] group">
            <img
              src={displayCover}
              alt={songTitle}
              onError={handleCoverError}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Card Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
            
            {/* Day stamp */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 border border-white/20 text-[9px] font-mono font-bold text-white tracking-widest">
              DAY {String(day).padStart(3, '0')}
            </div>

            {/* Bottom Card Meta */}
            <div className="absolute bottom-2 inset-x-2 text-left pointer-events-none">
              <p className="text-xs font-bold text-white truncate leading-tight">{songTitle}</p>
              <p className="text-[9px] font-mono text-white/60 truncate">{artist} · {bpm} BPM</p>
            </div>
          </div>

          {/* Status confirmations */}
          <div className="grid grid-cols-2 gap-2 mb-6 text-left">
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-[#39FF14] shrink-0" />
              <span className="text-[9px] font-mono font-bold text-white/80 uppercase">Wallet Minted</span>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-[#39FF14] shrink-0" />
              <span className="text-[9px] font-mono font-bold text-white/80 uppercase">Stage Unlocked</span>
            </div>
          </div>

          {/* Progress / Auto-start countdown bar */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-[10px] font-mono text-white/60">
              <span>Entering Sound Chamber</span>
              <span className="font-bold text-[#ff3800]">in {countdown}s...</span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 4, ease: 'linear' }}
                className="h-full bg-gradient-to-r from-[#ffd700] to-[#ff3800]"
              />
            </div>
          </div>

          {/* Instant Launch Button */}
          <button
            onClick={() => {
              audioManager.playSfx('select_start_song', 0.6);
              onStartGame();
            }}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#ff3800] via-[#ff6a00] to-[#ffd700] text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_25px_rgba(255,56,0,0.4)] cursor-pointer"
          >
            <Play size={16} fill="#000" />
            <span>START GAME NOW</span>
            <ChevronRight size={16} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
