import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeCheck, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { audioManager } from '../game/audio';

/**
 * SignedInConfirmModal — pops exactly once per real sign-in (never for guest
 * sessions, token refreshes, or page reloads) so the user gets visible proof
 * the identity actually changed — no more "did it work? refresh to check".
 */
export default function SignedInConfirmModal() {
  const { showSignedInConfirm, signedInAlias, setShowSignedInConfirm } = useAuthStore();

  const handleClose = () => {
    audioManager.playSfx('gold_get', 0.5);
    setShowSignedInConfirm(false);
  };

  useEffect(() => {
    if (!showSignedInConfirm) return;
    audioManager.playSfx('reward_claim', 0.5);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSignedInConfirm]);

  return (
    <AnimatePresence>
      {showSignedInConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="relative w-full max-w-md overflow-hidden border border-[#39FF14]/40 bg-[#09080c] shadow-[0_0_80px_rgba(57,255,20,0.18),0_25px_60px_rgba(0,0,0,0.95)]"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Multi-Tone Cyber Stripe */}
            <div className="h-[3px] w-full bg-gradient-to-r from-[#39FF14] via-[#FFD700] to-[#00E5FF]" />

            <div className="p-8 flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 260, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-[#39FF14]/10 border-2 border-[#39FF14] flex items-center justify-center mb-5"
              >
                <BadgeCheck size={32} className="text-[#39FF14]" />
              </motion.div>

              <span className="font-mono text-[9px] tracking-[0.35em] uppercase text-[#39FF14] mb-2">
                Identity Link Confirmed
              </span>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white font-display mb-2">
                Logged In
              </h2>
              <p className="font-mono text-sm text-white/70 mb-1">
                Welcome back,{' '}
                <span className="text-[#FFD700] font-bold">
                  {signedInAlias?.startsWith('@') ? signedInAlias : `@${signedInAlias ?? 'PILOT'}`}
                </span>
              </p>
              <p className="font-mono text-[11px] text-white/40 leading-relaxed mb-6">
                Your cards, streaks, and leaderboard identity are now bound to this session.
              </p>

              <button
                onClick={handleClose}
                className="w-full py-3 bg-[#39FF14] text-black font-black uppercase tracking-widest border-2 border-black shadow-[3px_3px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#000] transition-all flex justify-center items-center gap-2 cursor-pointer"
                style={{ fontFamily: 'Impact, sans-serif' }}
                autoFocus
              >
                Enter the Vault <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
