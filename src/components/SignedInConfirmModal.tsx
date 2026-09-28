import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeCheck, ArrowRight, Mail, Wallet, Fingerprint, Github, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { audioManager } from '../game/audio';
import { useTransmissionStore } from '../store/useTransmissionStore';

/**
 * SignedInConfirmModal — pops exactly once per real sign-in (email, passkey,
 * wallet, or OAuth) so the user gets visible proof the identity actually changed.
 */
export default function SignedInConfirmModal() {
  const { 
    showSignedInConfirm, 
    signedInAlias, 
    signedInMethod, 
    signedInEmail, 
    user, 
    setShowSignedInConfirm 
  } = useAuthStore();

  const autoDismissTimerRef = useRef<number | null>(null);

  const handleClose = () => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    audioManager.playSfx('gold_get', 0.5);
    setShowSignedInConfirm(false);
  };

  useEffect(() => {
    if (!showSignedInConfirm) return;
    audioManager.playSfx('reward_claim', 0.5);

    // Broadcast toast into the HUD stream
    const aliasLabel = signedInAlias?.startsWith('@') ? signedInAlias : `@${signedInAlias ?? 'PILOT'}`;
    useTransmissionStore.getState().addToast({
      type: 'success',
      badgeText: 'IDENTITY LINKED',
      title: 'CLEARANCE GRANTED',
      message: `Bound session to ${aliasLabel}`,
      durationMs: 5000,
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    // Gentle auto-dismiss after 7 seconds if left unattended
    autoDismissTimerRef.current = window.setTimeout(() => {
      handleClose();
    }, 7000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSignedInConfirm, signedInAlias]);

  // Derive display method and badge colors
  const activeMethod = signedInMethod || (user?.email ? 'email' : 'wallet');
  const methodConfig = {
    email: {
      label: 'EMAIL CLEARANCE',
      icon: Mail,
      accent: '#FF1493',
      identifier: signedInEmail || user?.email || null,
    },
    wallet: {
      label: 'BASE SMART WALLET',
      icon: Wallet,
      accent: '#39FF14',
      identifier: user?.user_metadata?.wallet_address 
        ? `${user.user_metadata.wallet_address.slice(0, 6)}…${user.user_metadata.wallet_address.slice(-4)}`
        : null,
    },
    passkey: {
      label: 'BIOMETRIC PASSKEY',
      icon: Fingerprint,
      accent: '#00E5FF',
      identifier: user?.email ? `Linked: ${user.email}` : 'WebAuthn Certified',
    },
    github: {
      label: 'GITHUB OAUTH',
      icon: Github,
      accent: '#A855F7',
      identifier: user?.user_metadata?.user_name ? `@${user.user_metadata.user_name}` : null,
    },
  }[activeMethod] || {
    label: 'SOVEREIGN IDENTITY',
    icon: Sparkles,
    accent: '#FFD700',
    identifier: null,
  };

  const MethodIcon = methodConfig.icon;

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
            <div className="h-[3px] w-full bg-gradient-to-r from-[#39FF14] via-[#FFD700] via-[#FF1493] to-[#00E5FF]" />

            <div className="p-8 flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 260, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-[#39FF14]/10 border-2 border-[#39FF14] flex items-center justify-center mb-4 relative"
              >
                <BadgeCheck size={34} className="text-[#39FF14]" />
                <div className="absolute inset-0 rounded-full border border-[#39FF14]/40 animate-ping" />
              </motion.div>

              {/* Protocol Method Badge */}
              <div 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm border font-mono text-[9px] uppercase tracking-[0.25em] font-extrabold mb-2"
                style={{
                  background: `${methodConfig.accent}15`,
                  borderColor: `${methodConfig.accent}40`,
                  color: methodConfig.accent,
                }}
              >
                <MethodIcon size={11} />
                <span>{methodConfig.label}</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white font-display mb-2">
                Identity Linked
              </h2>

              <p className="font-mono text-sm text-white/80 mb-2">
                Welcome back,{' '}
                <span className="text-[#FFD700] font-black">
                  {signedInAlias?.startsWith('@') ? signedInAlias : `@${signedInAlias ?? 'PILOT'}`}
                </span>
              </p>

              {methodConfig.identifier && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded font-mono text-[10px] text-zinc-300 mb-3">
                  <span className="text-white/40">AUTH_IDENTIFIER:</span>
                  <span className="text-white font-bold">{methodConfig.identifier}</span>
                </div>
              )}

              <p className="font-mono text-[11px] text-white/50 leading-relaxed mb-6 max-w-xs">
                Your cards, streaks, unlocked audio, and leaderboard rank are now bound to this device.
              </p>

              <button
                onClick={handleClose}
                className="w-full py-3.5 bg-[#39FF14] hover:bg-[#4dff2c] text-black font-black uppercase tracking-widest border-2 border-black shadow-[3px_3px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#000] active:translate-x-[2px] active:translate-y-[2px] transition-all flex justify-center items-center gap-2 cursor-pointer text-xs"
                style={{ fontFamily: 'Impact, sans-serif' }}
                autoFocus
              >
                <span>Enter the Vault</span>
                <ArrowRight size={16} />
              </button>

              {/* Progress Countdown Bar */}
              <div className="w-full h-1 bg-white/5 mt-4 overflow-hidden rounded-full">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 7, ease: 'linear' }}
                  className="h-full bg-gradient-to-r from-[#39FF14] to-[#00E5FF]"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
