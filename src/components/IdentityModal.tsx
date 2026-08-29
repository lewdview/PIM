import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserCheck } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { audioManager } from '../game/audio';
import IdentitySetup from './IdentitySetup';

interface IdentityModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
}

export default function IdentityModal({ isOpen: propIsOpen, onClose: propOnClose, onComplete }: IdentityModalProps) {
  const { showIdentityModal, setShowIdentityModal } = useAuthStore();
  const isOpen = propIsOpen !== undefined ? propIsOpen : showIdentityModal;

  const handleClose = () => {
    audioManager.playSfx('back', 0.4);
    if (propOnClose) propOnClose();
    setShowIdentityModal(false);
  };

  const handleComplete = () => {
    audioManager.playSfx('gold_get', 0.6);
    if (onComplete) onComplete();
    handleClose();
  };

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
        >
          {/* Main Modal Card */}
          <motion.div
            initial={{ scale: 0.93, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.93, y: 16, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative w-full max-w-lg overflow-hidden border border-[#FFD700]/30 bg-[#09080c] shadow-[0_0_80px_rgba(255,215,0,0.15),0_25px_60px_rgba(0,0,0,0.95)]"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
            }}
          >
            {/* Top Multi-Tone Cyber Stripe */}
            <div className="h-[3px] w-full bg-gradient-to-r from-[#FFD700] via-[#39FF14] to-[#00E5FF]" />

            {/* Corner Decorative Tech Brackets */}
            <div className="absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 border-[#FFD700]/70 pointer-events-none" />
            <div className="absolute top-2 right-4 w-2 h-2 border-t-2 border-r-2 border-[#39FF14]/70 pointer-events-none" />
            <div className="absolute bottom-2 left-4 w-2 h-2 border-b-2 border-l-2 border-[#00E5FF]/70 pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 border-[#FFD700]/70 pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all active:scale-90 cursor-pointer z-50 rounded-sm"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>

            {/* Modal Header */}
            <div className="pt-6 pb-4 px-6 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse" />
                <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-[#FFD700]">
                  LEADERBOARD CLEARANCE PROTOCOL
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2.5 font-display">
                <UserCheck className="text-[#FFD700]" size={24} />
                Lock In Pilot Identity
              </h2>
              <p className="font-mono text-[11px] text-zinc-400 mt-1 leading-relaxed">
                Choose a unique @username and profile avatar to record, transmit, and broadcast scores on global leaderboards.
              </p>
            </div>

            {/* Setup Form Container */}
            <div className="p-2">
              <IdentitySetup compact onComplete={handleComplete} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
