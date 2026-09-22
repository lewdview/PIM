import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Heart, Shield, Zap, Volume2, ArrowUp, ArrowRight, CheckCircle2, AlertTriangle, Play } from 'lucide-react';

export type TutorialStepType = 'tap' | 'hold' | 'swipe' | 'hold-swipe' | 'slide' | 'remix' | 'lift';

export interface TutorialOverlayProps {
  currentStep: TutorialStepType;
  stepIndex: number;
  totalSteps: number;
  successCount: number;
  requiredSuccesses: number;
  chancesLeft: number;
  maxChances: number;
  lastHitResult: 'success' | 'miss' | null;
  showRewindModal: boolean;
  showHealthModal: boolean;
  stage1Cleared: boolean;
  onDismissRewindModal: () => void;
  onDismissHealthModal: () => void;
}

const STEP_METADATA: Record<TutorialStepType, { title: string; subtitle: string; icon: string; accent: string }> = {
  'tap': {
    title: 'TAP NOTE',
    subtitle: 'Press lane key (D F J) or tap screen when note hits the trigger line',
    icon: '■',
    accent: '#39FF14',
  },
  'hold': {
    title: 'HOLD NOTE & HEALING',
    subtitle: 'Press and HOLD key/screen until ribbon tail finishes. Charges Healing Gauge!',
    icon: '▬',
    accent: '#FFD700',
  },
  'swipe': {
    title: 'SWIPE NOTE',
    subtitle: 'Flick arrow key or swipe screen in the chevron direction as it strikes',
    icon: '➔',
    accent: '#00E5FF',
  },
  'hold-swipe': {
    title: 'HOLD + SWIPE RELEASE',
    subtitle: 'Hold ribbon down, then flick in arrow direction exactly as the tail ends',
    icon: '⚡',
    accent: '#FF1493',
  },
  'slide': {
    title: 'SLIDE NOTE',
    subtitle: 'Hold key and follow the shifting lane ribbon across the highway',
    icon: '⮀',
    accent: '#A855F7',
  },
  'remix': {
    title: 'STEM REMIX NOTE',
    subtitle: 'Strike to trigger real-time DSP stem isolation (solo vocals, mute drums)',
    icon: '⚡',
    accent: '#00F5D4',
  },
  'lift': {
    title: 'LIFT NOTE',
    subtitle: 'Release key or flick upward cleanly on beat without tapping down',
    icon: '▲',
    accent: '#00FF88',
  },
};

export default function TutorialOverlay({
  currentStep,
  stepIndex,
  totalSteps,
  successCount,
  requiredSuccesses,
  chancesLeft,
  maxChances,
  lastHitResult,
  showRewindModal,
  showHealthModal,
  stage1Cleared,
  onDismissRewindModal,
  onDismissHealthModal,
}: TutorialOverlayProps) {
  const meta = STEP_METADATA[currentStep] || STEP_METADATA['tap'];

  return (
    <>
      {/* ── Persistent Tutorial HUD Header & Objective Tracker ── */}
      <div className="absolute top-14 left-0 right-0 z-40 pointer-events-none flex flex-col items-center px-4">
        <motion.div
          key={currentStep}
          initial={{ y: -15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="max-w-md w-full bg-[#0c0c14]/90 backdrop-blur-md border border-white/15 px-4 py-3 rounded shadow-[0_8px_32px_rgba(0,0,0,0.8)] relative overflow-hidden"
          style={{ borderTopColor: meta.accent }}
        >
          {/* Top colored accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: meta.accent }} />

          <div className="flex items-center justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest text-black"
                style={{ background: meta.accent }}
              >
                [{stepIndex + 1}/{totalSteps}]
              </span>
              <span className="font-mono text-xs font-black uppercase text-white tracking-wider">
                {meta.title}
              </span>
            </div>

            {/* Hits & Chances Indicators */}
            <div className="flex items-center gap-3">
              {/* Hits Progress Pips */}
              <div className="flex items-center gap-1 font-mono text-[9px] font-bold text-zinc-400">
                <span className="text-[8px] tracking-wider uppercase text-emerald-400">HITS:</span>
                {Array.from({ length: requiredSuccesses }).map((_, i) => {
                  const isHit = i < successCount;
                  return (
                    <div
                      key={`hit-${i}`}
                      className="w-2.5 h-2.5 rounded-sm transition-all duration-300"
                      style={{
                        background: isHit ? '#39FF14' : '#27272a',
                        boxShadow: isHit ? '0 0 6px rgba(57,255,20,0.8)' : 'none',
                        border: `1px solid ${isHit ? '#000' : '#3f3f46'}`,
                      }}
                    />
                  );
                })}
              </div>

              {/* Chances Pips Display */}
              <div className="flex items-center gap-1 font-mono text-[9px] font-bold text-zinc-400">
                <span className="text-[8px] tracking-wider uppercase text-pink-400">LIVES:</span>
                {Array.from({ length: maxChances }).map((_, i) => {
                  const isActive = i < chancesLeft;
                  return (
                    <div
                      key={`chance-${i}`}
                      className="w-2.5 h-2.5 rounded-sm transition-all duration-300"
                      style={{
                        background: isActive ? meta.accent : '#27272a',
                        boxShadow: isActive ? `0 0 6px ${meta.accent}80` : 'none',
                        border: `1px solid ${isActive ? '#000' : '#3f3f46'}`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <p className="font-mono text-[10px] text-zinc-300 leading-snug">
            {meta.subtitle}
          </p>

          {/* Dynamic Hit Feedback Flash */}
          <AnimatePresence>
            {lastHitResult === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="mt-2 py-1 px-2 bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14] font-mono text-[9.5px] font-black tracking-widest uppercase flex items-center gap-1.5 rounded-sm"
              >
                <CheckCircle2 size={12} />
                {successCount >= requiredSuccesses
                  ? `OBJECTIVE CLEARED! (${successCount}/${requiredSuccesses} COMPLETE)`
                  : `HIT ${successCount}/${requiredSuccesses} CONFIRMED! [${requiredSuccesses - successCount} MORE TO CLEAR]`}
              </motion.div>
            )}
            {lastHitResult === 'miss' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="mt-2 py-1 px-2 bg-[#FF1493]/20 border border-[#FF1493] text-[#FF1493] font-mono text-[9.5px] font-black tracking-widest uppercase flex items-center gap-1.5 rounded-sm"
              >
                <AlertTriangle size={12} />
                ATTEMPT MISSED — {chancesLeft > 0 ? `${chancesLeft} CHANCE${chancesLeft > 1 ? 'S' : ''} REMAINING` : 'TRIGGERING REWIND...'}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Modal 1: Health Concept & Healing Frequencies (Triggered on Hold Notes) ── */}
      <AnimatePresence>
        {showHealthModal && (
          <div className="absolute inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              className="relative max-w-md w-full border-2 border-[#FFD700] bg-[#0c0c14] p-6 text-left shadow-[0_0_60px_rgba(255,215,0,0.25),8px_8px_0px_#000] rounded-lg"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
              }}
            >
              <div className="flex items-center gap-2 mb-2 font-mono text-[9px] text-[#FFD700] tracking-[0.3em] font-black uppercase">
                <Heart size={12} className="text-[#FFD700] fill-[#FFD700]" />
                // SURVIVABILITY ENGINE //
              </div>

              <h2 className="font-mono text-2xl font-black text-white uppercase tracking-tight mb-4">
                THE HEALTH CONCEPT <br />
                <span className="text-[#FFD700]">& HEALING FREQUENCIES</span>
              </h2>

              <div className="space-y-3 font-mono text-[11px] text-zinc-300 leading-relaxed border-t border-b border-white/10 py-4 mb-5">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-sm bg-[#FF1493]/20 border border-[#FF1493] flex items-center justify-center shrink-0 text-[#FF1493] font-black text-[10px]">
                    3
                  </div>
                  <div>
                    <span className="text-white font-bold block">3-MISS HEALTH LIMIT:</span>
                    Failing 3 notes drains all health and triggers emergency continue.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-sm bg-[#00E5FF]/20 border border-[#00E5FF] flex items-center justify-center shrink-0 text-[#00E5FF]">
                    <Volume2 size={12} />
                  </div>
                  <div>
                    <span className="text-white font-bold block">SONIC PUNISHMENT:</span>
                    Missing notes mutes the audio track's physical frequency bands (Bass, Mids, Treble).
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-sm bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center shrink-0 text-[#FFD700]">
                    <Zap size={12} />
                  </div>
                  <div>
                    <span className="text-[#FFD700] font-black block">HEALING FREQUENCY RECHARGE:</span>
                    Sustaining <strong className="text-white">HOLD ribbons</strong> continuously charges your Healing Gauge (~28%/sec). Fully filling the meter <strong className="text-[#39FF14]">restores a lost miss and re-opens muted audio lanes!</strong>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-sm bg-red-500/20 border border-red-500 flex items-center justify-center shrink-0 text-red-400">
                    <AlertTriangle size={12} />
                  </div>
                  <div>
                    <span className="text-red-400 font-bold block">PREMATURE RELEASE HAZARD:</span>
                    Releasing a hold note before the ribbon tail ends counts as an instant miss!
                  </div>
                </div>
              </div>

              <button
                onClick={onDismissHealthModal}
                className="w-full py-4 bg-gradient-to-r from-[#FFD700] to-amber-500 text-black font-mono font-black text-xs tracking-[0.25em] uppercase hover:scale-[1.02] active:scale-95 transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] cursor-pointer flex items-center justify-center gap-2"
              >
                <Play size={14} fill="currentColor" />
                ENGAGE HOLD NOTE TRAINING
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal 2: Emergency Rewind Explainer (Triggered on 3 Misses) ── */}
      <AnimatePresence>
        {showRewindModal && (
          <div className="absolute inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              className="relative max-w-md w-full border-2 border-[#FF1493] bg-[#0c0c14] p-6 text-left shadow-[0_0_60px_rgba(255,20,147,0.3),8px_8px_0px_#000] rounded-lg"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
              }}
            >
              <div className="flex items-center gap-2 mb-2 font-mono text-[9px] text-[#FF1493] tracking-[0.3em] font-black uppercase">
                <RotateCcw size={12} className="text-[#FF1493] animate-spin" />
                // TIME-REVERSAL SYSTEM //
              </div>

              <h2 className="font-mono text-2xl font-black text-white uppercase tracking-tight mb-4">
                THE REWIND TECHNIQUE <br />
                <span className="text-[#FF1493]">EMERGENCY RECOVERY</span>
              </h2>

              <div className="space-y-3.5 font-mono text-[11px] text-zinc-300 leading-relaxed border-t border-b border-white/10 py-4 mb-5">
                <div className="bg-[#FF1493]/10 border border-[#FF1493]/40 p-2.5 rounded text-white text-[10px]">
                  ⚡ <strong className="text-[#FF1493]">YOU MISSED 3 TIMES!</strong> The engine automatically executed an emergency rewind.
                </div>

                <p>
                  In PIM, accumulating 3 misses triggers the <strong className="text-white">Rewind Mechanism</strong> instead of an abrupt game over.
                </p>

                <div className="space-y-2 text-[10px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
                    <span><strong>Highway Rolls Back 2.5 Seconds:</strong> Canvas scrolls in reverse.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14]" />
                    <span><strong>Notes Restored:</strong> Miss flags in the rewind window are cleared.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700]" />
                    <span><strong>Chances Reset:</strong> You have 3 fresh attempts to nail the pattern!</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onDismissRewindModal}
                className="w-full py-4 bg-gradient-to-r from-[#FF1493] to-[#ff3800] text-black font-mono font-black text-xs tracking-[0.25em] uppercase hover:scale-[1.02] active:scale-95 transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} />
                RESUME FLIGHT TRAINING [3 CHANCES READY]
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Stage 1 Cleared Celebration Stinger ── */}
      <AnimatePresence>
        {stage1Cleared && (
          <div className="absolute inset-0 z-[150] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm pointer-events-none">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              className="text-center"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-[#39FF14] to-[#00E5FF] p-1 mb-4 shadow-[0_0_50px_#39FF14]">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-[#39FF14]">
                  <CheckCircle2 size={42} />
                </div>
              </div>
              <div className="font-mono text-xs text-[#39FF14] tracking-[0.4em] uppercase font-black mb-1">
                // STAGE 1 CERTIFIED //
              </div>
              <h1 className="font-mono text-4xl md:text-5xl font-black uppercase text-white tracking-tighter">
                FLIGHT ACADEMY <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39FF14] via-[#00E5FF] to-[#FF1493]">
                  COMPLETE
                </span>
              </h1>
              <p className="font-mono text-xs text-zinc-400 mt-3 tracking-widest uppercase">
                Synchronizing decrypted rewards & welcome pack...
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
