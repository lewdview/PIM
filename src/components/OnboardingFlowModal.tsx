import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Gift, Check, Shield, Layers, ArrowRight, Wallet, Lock, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import { audioManager } from '../game/audio';

interface OnboardingFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameStats?: {
    accuracy: number;
    notesHit: number;
    maxCombo: number;
    songTitle?: string;
    dayNumber?: number;
  };
}

type FunnelStep = 'SAVE_RUN' | 'WELCOME_PACK' | 'PACK_OPENING' | 'CARD_REVEAL' | 'COLLECT_ONCHAIN';

export default function OnboardingFlowModal({ isOpen, onClose, gameStats }: OnboardingFlowModalProps) {
  const { signInWithMagicLink, signInWithWallet, user, status } = useAuthStore();
  const { addCardToCollection, shards, addShards } = useVaultStore();

  const [step, setStep] = useState<FunnelStep>('SAVE_RUN');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dayNum = gameStats?.dayNumber || 208;
  const accuracy = gameStats?.accuracy || 96;

  // Handle Account Creation / Save Run
  const handleSaveRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      audioManager.playSfx('reward_claim', 0.5);
      const res = await signInWithMagicLink(email.trim());
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        // Advance to Welcome Pack
        setStep('WELCOME_PACK');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save run');
    } finally {
      setLoading(false);
    }
  };

  // Open Pack Trigger
  const handleOpenPack = () => {
    audioManager.playSfx('pack_open', 0.6);
    setStep('PACK_OPENING');
    setTimeout(() => {
      // Award Card & Shards
      addCardToCollection({
        id: `card-day-${dayNum}`,
        songId: `day-${String(dayNum).padStart(3, '0')}`,
        day: dayNum,
        title: gameStats?.songTitle || "Today's Drop",
        artist: 'th3scr1b3',
        coverArt: `/assets/covers/day_${dayNum}.jpg`,
        rarity: 'EPIC',
        serialNumber: 1,
        editionSize: 1000,
        unlockedAt: new Date().toISOString(),
        shardYield: 50,
      });
      addShards(50);
      setStep('CARD_REVEAL');
    }, 1800);
  };

  // Handle On-Chain Connection
  const handleConnectWallet = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      audioManager.playSfx('reward_claim', 0.6);
      const res = await signInWithWallet();
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Wallet connection failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence font-sans>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
      >
        <motion.div
          initial={{ scale: 0.92, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.92, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/15 bg-neutral-950/90 shadow-[0_0_80px_rgba(255,20,147,0.2)] p-6 text-white"
        >
          {/* Close / Skip button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>

          {/* STEP 1: SAVE YOUR RUN */}
          {step === 'SAVE_RUN' && (
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF1493] font-bold">
                // COMPLETED DAY {dayNum} //
              </div>

              <div className="border border-white/10 bg-white/5 rounded-lg p-4 w-full flex items-center justify-around font-mono">
                <div>
                  <div className="text-2xl font-black text-white">{accuracy}%</div>
                  <div className="text-[9px] uppercase tracking-wider text-white/50">ACCURACY</div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <div className="text-2xl font-black text-[#00E5FF]">{gameStats?.notesHit || 742}</div>
                  <div className="text-[9px] uppercase tracking-wider text-white/50">NOTES</div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <div className="text-2xl font-black text-[#39FF14]">{gameStats?.maxCombo || 31}</div>
                  <div className="text-[9px] uppercase tracking-wider text-white/50">COMBO</div>
                </div>
              </div>

              <div>
                <h2 className="font-mono text-xl font-bold tracking-wide uppercase text-white mb-1">
                  SAVE YOUR PROGRESS
                </h2>
                <p className="font-sans text-xs text-white/70 leading-relaxed px-2">
                  Create your free PIM account to keep today&apos;s achievement, collection and daily streak.
                </p>
              </div>

              {errorMsg && (
                <div className="font-mono text-[11px] text-red-400 bg-red-950/40 border border-red-500/30 px-3 py-1.5 rounded w-full">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSaveRun} className="w-full space-y-3">
                <input
                  type="email"
                  placeholder="Enter email to save your run..."
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded bg-white/5 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-[#FF1493] transition-colors"
                  required
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded font-mono text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-white/90 transition-all flex items-center justify-center gap-2 active:scale-98 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                >
                  <Sparkles size={14} />
                  {loading ? 'SAVING RUN...' : 'SAVE YOUR RUN'}
                </button>
              </form>

              <div className="flex flex-col gap-1.5 pt-2 text-[11px] font-mono text-white/50">
                <button onClick={onClose} className="hover:text-white transition-colors">
                  Already have one? <span className="underline text-white/80">Log in</span>
                </button>
                <button onClick={onClose} className="hover:text-white/70 transition-colors">
                  Maybe later
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: WELCOME PACK */}
          {step === 'WELCOME_PACK' && (
            <div className="flex flex-col items-center text-center space-y-6 py-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#FF1493] to-[#00E5FF] p-0.5 shadow-[0_0_30px_rgba(255,20,147,0.4)]">
                <div className="w-full h-full bg-black rounded-full flex items-center justify-center">
                  <Gift size={28} className="text-white" />
                </div>
              </div>

              <div>
                <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#39FF14] font-bold mb-1">
                  // ACCOUNT CREATED //
                </div>
                <h2 className="font-mono text-2xl font-black uppercase text-white mb-2">
                  WELCOME TO PIM
                </h2>
                <p className="font-sans text-xs text-white/70">
                  Your first pack is ready.
                </p>
              </div>

              <button
                onClick={handleOpenPack}
                className="w-full py-4 px-6 rounded font-mono text-xs font-bold uppercase tracking-widest bg-gradient-to-r from-[#FF1493] via-[#ff3800] to-[#E5B800] text-white hover:opacity-95 transition-all shadow-[0_0_25px_rgba(255,56,0,0.4)] active:scale-98"
              >
                OPEN YOUR PACK
              </button>
            </div>
          )}

          {/* STEP 3: PACK OPENING ANIMATION */}
          {step === 'PACK_OPENING' && (
            <div className="flex flex-col items-center text-center space-y-6 py-8">
              <div className="w-24 h-24 rounded-2xl border-2 border-white/40 bg-white/10 flex items-center justify-center animate-bounce shadow-[0_0_50px_rgba(255,255,255,0.4)]">
                <Gift size={40} className="text-white animate-spin-slow" />
              </div>
              <div className="font-mono text-xs tracking-widest uppercase text-white/80 animate-pulse">
                UNSEALING WELCOME PACK...
              </div>
            </div>
          )}

          {/* STEP 4: CARD REVEAL */}
          {step === 'CARD_REVEAL' && (
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#39FF14] font-bold">
                // ARCHIVE UNLOCKED //
              </div>

              <div className="relative w-40 h-56 rounded-lg border-2 border-[#E5B800] bg-black overflow-hidden shadow-[0_0_30px_rgba(229,184,0,0.4)] flex flex-col justify-between p-3">
                <div className="flex justify-between items-center text-[9px] font-mono text-[#E5B800]">
                  <span>DAY {dayNum}</span>
                  <span>EPIC</span>
                </div>
                <div className="my-auto font-mono text-sm font-bold text-white">
                  {gameStats?.songTitle || `Day ${dayNum} Release`}
                </div>
                <div className="text-[8px] font-mono text-white/50">th3scr1b3</div>
              </div>

              <div>
                <h3 className="font-mono text-lg font-bold text-white uppercase">
                  YOUR COLLECTION
                </h3>
                <div className="font-mono text-xs text-[#39FF14] font-bold mt-1">
                  1 / 365
                </div>
                <p className="font-sans text-xs text-white/70 mt-2">
                  Today&apos;s Drop is now part of your archive.
                </p>
              </div>

              <button
                onClick={() => setStep('COLLECT_ONCHAIN')}
                className="w-full py-3.5 px-6 rounded font-mono text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-white/90 transition-all flex items-center justify-center gap-2"
              >
                CONTINUE <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* STEP 5: LEVEL 3 COLLECT ON-CHAIN WALLET PROMPT */}
          {step === 'COLLECT_ONCHAIN' && (
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-white/5 border border-white/20 flex items-center justify-center">
                <Wallet size={24} className="text-[#00E5FF]" />
              </div>

              <div>
                <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#00E5FF] font-bold mb-1">
                  // OWNERSHIP UPGRADE //
                </div>
                <h2 className="font-mono text-lg font-bold uppercase text-white mb-2">
                  YOUR PIM ACCOUNT IS READY
                </h2>
                <p className="font-sans text-xs text-white/70 leading-relaxed px-2">
                  Your collection is saved. Want to take ownership to the next level?
                </p>
              </div>

              <div className="border border-[#00E5FF]/30 bg-[#00E5FF]/5 rounded-lg p-3 w-full text-xs font-sans text-white/80">
                Your Welcome Pack can become part of your on-chain collection on Base L2.
              </div>

              {errorMsg && (
                <div className="font-mono text-[11px] text-red-400 bg-red-950/40 border border-red-500/30 px-3 py-1.5 rounded w-full">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleConnectWallet}
                disabled={loading}
                className="w-full py-3.5 px-6 rounded font-mono text-xs font-bold uppercase tracking-widest bg-gradient-to-r from-[#00E5FF] to-[#39FF14] text-black hover:opacity-95 transition-all shadow-[0_0_20px_rgba(0,229,255,0.3)] active:scale-98 flex items-center justify-center gap-2"
              >
                <Shield size={14} />
                {loading ? 'CONNECTING...' : 'COLLECT ON-CHAIN'}
              </button>

              <button
                onClick={onClose}
                className="font-mono text-[11px] text-white/50 hover:text-white transition-colors pt-1"
              >
                Maybe later
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
