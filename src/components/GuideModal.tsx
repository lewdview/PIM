import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Zap, BookOpen, Printer, Sliders, Play, Volume2, ShieldAlert, Award, Compass, Flame, HelpCircle } from 'lucide-react';
import { getAdminConfig, type ConditionalModifier } from '../utils/adminConfig';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'start' | 'notes' | 'audio' | 'overdrive' | 'modifiers' | 'economy' | 'matrix' | 'rewards';

export default function GuideModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('start');
  const [modifiers, setModifiers] = useState<ConditionalModifier[]>([]);

  useEffect(() => {
    if (isOpen) {
      const config = getAdminConfig();
      setModifiers(config.modifiers.filter(m => m.enabled));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {/* Print-specific style sheet override */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-pim-booklet, #printable-pim-booklet * {
            visibility: visible !important;
          }
          #printable-pim-booklet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 24px !important;
            overflow: visible !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            z-index: 99999 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            border-bottom: 3px solid #000 !important;
            padding-bottom: 12px !important;
            margin-bottom: 20px !important;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 12px !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #666 !important;
            padding: 6px 10px !important;
            text-align: left !important;
            font-size: 11px !important;
          }
          .print-table th {
            background: #eee !important;
          }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md select-text"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 25, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 25, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col bg-[#080705] border-2 border-[#39ff14]/40 rounded-2xl shadow-[0_0_50px_rgba(57,255,20,0.15)]"
          onClick={e => e.stopPropagation()}
        >
          {/* Top Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.03] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#39ff14]/15 border border-[#39ff14]/40 flex items-center justify-center text-[#39ff14]">
                <BookOpen size={20} />
              </div>
              <div>
                <h2 className="font-['Impact'] text-xl tracking-wider uppercase m-0 leading-tight text-white flex items-center gap-2">
                  <span>PIM : th3v4ult</span>
                  <span className="text-[#39ff14] text-xs font-mono font-normal tracking-widest px-2 py-0.5 rounded bg-[#39ff14]/10 border border-[#39ff14]/30">
                    INSTRUCTION BOOKLET
                  </span>
                </h2>
                <p className="font-mono text-[10px] text-white/50 m-0 uppercase tracking-widest">
                  POETRY IN MOTION // OFFICIAL OPERATING MANUAL v2.1
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#39ff14] text-black font-mono font-black text-xs uppercase tracking-wider hover:bg-[#39ff14]/90 active:scale-95 transition-all shadow-[0_0_15px_rgba(57,255,20,0.4)] cursor-pointer"
                title="Print Instruction Booklet or Save as PDF"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">PRINT / PDF</span>
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors opacity-60 hover:opacity-100 active:scale-95 duration-150 cursor-pointer text-white"
                aria-label="Close booklet"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Navigation Bar / Tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-black/40 overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: 'start', label: 'Quick Start', icon: Compass },
              { id: 'notes', label: 'Note Types', icon: Play },
              { id: 'audio', label: 'Sonic Muting', icon: Volume2 },
              { id: 'overdrive', label: 'Flow State', icon: Zap },
              { id: 'modifiers', label: 'Modifiers', icon: Sliders },
              { id: 'economy', label: 'Forge & Cards', icon: Flame },
              { id: 'matrix', label: 'Events Matrix', icon: ShieldAlert },
              { id: 'rewards', label: 'Ultra Rewards', icon: Sparkles },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/50 shadow-[0_0_10px_rgba(57,255,20,0.2)]'
                      : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Main Scrollable Body Content */}
          <div id="printable-pim-booklet" className="flex-1 overflow-y-auto p-6 space-y-6 text-white/90 font-mono text-xs leading-relaxed">
            
            {/* Print Header (Only visible when printing) */}
            <div className="hidden print-header">
              <h1 style={{ margin: 0, fontSize: '24px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                PIM : th3v4ult - POETRY IN MOTION
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#555' }}>
                OFFICIAL OPERATING MANUAL & INSTRUCTION BOOKLET // ALL GAME SYSTEMS & EVENT MECHANICS
              </p>
            </div>

            {/* TAB 1: QUICK START */}
            {activeTab === 'start' && (
              <div className="space-y-6">
                <section className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <h3 className="font-['Impact'] text-lg text-[#39ff14] uppercase tracking-wide m-0 mb-2 flex items-center gap-2">
                    <Compass size={18} />
                    <span>3-Lane Highway Quick Start</span>
                  </h3>
                  <p className="text-white/80 text-[11px] m-0 mb-4">
                    PIM (Poetry In Motion) projects descending rhythm note rails down a perspective 3D highway. Press the matching key or swipe your touchscreen as target notes pass the glowing hit line.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-black/50 border border-white/10">
                      <div className="text-[#a855f7] font-bold text-xs uppercase mb-1">LANE 0 (LEFT / BASS)</div>
                      <div className="text-white font-black text-sm mb-1">KEY [ A ] / [ 1 ] / [ J ]</div>
                      <div className="text-[10px] text-white/50">Controls sub-bass and kick audio frequencies (Lowpass &lt;300Hz).</div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/50 border border-white/10">
                      <div className="text-[#00e5ff] font-bold text-xs uppercase mb-1">LANE 1 (MID / VOCALS)</div>
                      <div className="text-white font-black text-sm mb-1">KEY [ S ] / [ 2 ] / [ K ]</div>
                      <div className="text-[10px] text-white/50">Controls vocal and lead synthesizer channels (Bandpass 1200Hz).</div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/50 border border-white/10">
                      <div className="text-[#ff3800] font-bold text-xs uppercase mb-1">LANE 2 (RIGHT / TREBLE)</div>
                      <div className="text-white font-black text-sm mb-1">KEY [ D ] / [ 3 ] / [ L ]</div>
                      <div className="text-[10px] text-white/50">Controls high-hats and cymbals (Highpass &gt;3200Hz).</div>
                    </div>
                  </div>
                </section>

                <section className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <h3 className="font-['Impact'] text-lg text-[#ffb800] uppercase tracking-wide m-0 mb-2">
                    Audio Latency & Calibration
                  </h3>
                  <p className="text-[11px] text-white/70 m-0">
                    Bluetooth headphones or TV speakers introduce millisecond audio delays. Navigate to <strong className="text-white">⚙ Options</strong> in the menu bar to adjust your <strong className="text-[#ffb800]">AUDIO OFFSET (ms)</strong>. Set negative values if hits feel late, or positive values if hits feel early.
                  </p>
                </section>
              </div>
            )}

            {/* TAB 2: NOTE TAXONOMY */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
                  <div className="border-b border-white/10 pb-3">
                    <h4 className="font-['Impact'] text-base text-[#39ff14] uppercase m-0 mb-1">1. Tap Notes (Standard Rectangles)</h4>
                    <p className="text-[11px] text-white/70 m-0">
                      Solid rectangular targets. Press the lane key exactly as the note center overlaps the target line.
                    </p>
                  </div>

                  <div className="border-b border-white/10 pb-3">
                    <h4 className="font-['Impact'] text-base text-[#00e5ff] uppercase m-0 mb-1">2. Swipe Notes (Directional Chevrons)</h4>
                    <p className="text-[11px] text-white/70 m-0">
                      Unlocked at Level 4+. Chevron arrows pointing in 8 directions (UP, DOWN, LEFT, RIGHT, and diagonals). Flick the arrow key or swipe the screen in the indicated direction.
                    </p>
                  </div>

                  <div className="border-b border-white/10 pb-3">
                    <h4 className="font-['Impact'] text-base text-[#a855f7] uppercase m-0 mb-1">3. Hold & Slide Notes (Sustained Rails)</h4>
                    <p className="text-[11px] text-white/70 m-0">
                      Unlocked at Level 7+. Press and hold down the lane key when the head arrives, tracking winding slide tails across lanes until the ribbon finishes.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-['Impact'] text-base text-[#ffb800] uppercase m-0 mb-1 flex items-center gap-1.5">
                      <span>4. Remix Notes ⚡</span>
                      <span className="text-[9px] bg-[#ffb800]/20 text-[#ffb800] px-1.5 py-0.5 rounded font-mono">PIM SIGNATURE</span>
                    </h4>
                    <p className="text-[11px] text-white/70 m-0">
                      Striking a glowing Remix Note with PERFECT timing triggers real-time stem arrangement mutations (vocal isolation, bass drops), flips the visual canvas theme, and awards +1000 bonus points!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SONIC PUNISHMENT */}
            {activeTab === 'audio' && (
              <div className="space-y-4">
                <section className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3">
                  <h3 className="font-['Impact'] text-lg text-red-400 uppercase tracking-wide m-0 flex items-center gap-2">
                    <Volume2 size={18} />
                    <span>Real-Time Multi-Band Audio Degradation</span>
                  </h3>
                  <p className="text-[11px] text-white/80 m-0">
                    Unlike ordinary games that only decrease points when you miss, PIM physically mutes the audio stem assigned to that lane:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-[11px] text-white/70">
                    <li><strong className="text-white">Muting on Miss:</strong> Missing a note immediately drops channel volume gain to <strong className="text-red-400">0.04</strong> over 0.12 seconds.</li>
                    <li><strong className="text-white">Active Restore on Hit:</strong> Striking the next note in a muted lane instantly un-silences that stem, ramping volume back over 0.25s.</li>
                    <li><strong className="text-white">Passive Auto-Recovery:</strong> If a lane is muted and no notes appear for <strong className="text-[#39ff14]">3.5 seconds</strong>, auto-recovery restores channel volume to prevent total track silence.</li>
                  </ul>
                </section>
              </div>
            )}

            {/* TAB 4: OVERDRIVE & FLOW STATE */}
            {activeTab === 'overdrive' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-[#ffb800]/10 border border-[#ffb800]/30 space-y-2">
                    <div className="text-[#ffb800] font-['Impact'] text-base uppercase">FEVER MODE (20+ COMBO)</div>
                    <div className="text-xs font-bold text-white">2x Multiplier</div>
                    <p className="text-[10px] text-white/70 m-0">
                      Lasts 9 seconds. Automatically upgrades all standard PERFECT hits to PERFECT+. Gold aura screen overlay.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#ff1493]/10 border border-[#ff1493]/30 space-y-2">
                    <div className="text-[#ff1493] font-['Impact'] text-base uppercase">SURGE MODE (40+ COMBO)</div>
                    <div className="text-xs font-bold text-white">3x Multiplier + Autoplay</div>
                    <p className="text-[10px] text-white/70 m-0">
                      Lasts 11 seconds. Autoplay assist automatically tracks hold rails and slide notes for you. Hot pink pulse.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#39ff14]/10 border border-[#39ff14]/30 space-y-2">
                    <div className="text-[#39ff14] font-['Impact'] text-base uppercase">SIGNAL LOCK (60+ COMBO)</div>
                    <div className="text-xs font-bold text-white">4x Multiplier</div>
                    <p className="text-[10px] text-white/70 m-0">
                      Lasts 14 seconds. Peak matrix visual flow state with bright green glow overlay.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: GAMEPLAY MODIFIERS */}
            {activeTab === 'modifiers' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                  <h3 className="font-['Impact'] text-lg text-[#00e5ff] uppercase tracking-wide m-0">
                    Card-Equipped Modifiers
                  </h3>
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                      <div className="text-[#00e5ff] font-bold text-xs uppercase mb-1">VOCAL ISOLATION</div>
                      <p className="text-[10px] text-white/70 m-0">
                        Triggered on Acoustic/Pop tracks (BPM &le;100). Boosts vocal channel (Gain 2.2) while dampening low-end and high-end channels (Gain 0.15).
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                      <div className="text-[#a855f7] font-bold text-xs uppercase mb-1">BASS REALM</div>
                      <p className="text-[10px] text-white/70 m-0">
                        Triggered on Electro/Techno tracks (BPM &gt;120). Amplifies bass channel (Gain 2.6). Lane 0 notes turn neon purple, render 60% thicker, and 28% wider.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                      <div className="text-[#ff5500] font-bold text-xs uppercase mb-1">CORRUPTED SIGNAL</div>
                      <p className="text-[10px] text-white/70 m-0">
                        Triggered on Glitch/Industrial tracks. Drives tempo drift (&plusmn;4%), CRT scanlines, and screen shake.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: FORGE & ECONOMY */}
            {activeTab === 'economy' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                  <h3 className="font-['Impact'] text-lg text-[#ffb800] uppercase tracking-wide m-0">
                    The Forge & Token Sinks
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                    <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                      <div className="text-[#ffb800] font-bold uppercase mb-1">TARGETED PULL (500 V⚡)</div>
                      <p className="text-white/60 m-0">Directly acquire any specific card from the 365 daily release catalog.</p>
                    </div>

                    <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                      <div className="text-[#39ff14] font-bold uppercase mb-1">RARITY UPGRADE (150 V⚡)</div>
                      <p className="text-white/60 m-0">Upgrade an owned card to the next higher rarity tier.</p>
                    </div>

                    <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                      <div className="text-[#a855f7] font-bold uppercase mb-1">DUPLICATE FUSION</div>
                      <p className="text-white/60 m-0">Fuse 3 identical cards (same day & rarity) to create 1 card of the next tier.</p>
                    </div>

                    <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                      <div className="text-red-400 font-bold uppercase mb-1">ECHO GENERATION DECAY</div>
                      <p className="text-white/60 m-0">Echo variants decay across generations (Gen 0 &rarr; Gen 1 &rarr; Gen 2 &rarr; Gen 3+ Entropy Death).</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: EVENTS MATRIX */}
            {activeTab === 'matrix' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <h3 className="font-['Impact'] text-lg text-[#39ff14] uppercase tracking-wide m-0 mb-3">
                    Complete Dynamic Events Matrix
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse print-table">
                      <thead>
                        <tr className="border-b border-white/20 text-[#39ff14] font-mono text-[10px] uppercase">
                          <th className="py-2 px-3">Event Name</th>
                          <th className="py-2 px-3">Trigger Condition</th>
                          <th className="py-2 px-3">Immediate Response</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10 font-mono text-[10px] text-white/80">
                        <tr>
                          <td className="py-2 px-3 text-[#ffb800] font-bold">Perfect+ Hit</td>
                          <td className="py-2 px-3">&le; TimingWindow P+</td>
                          <td className="py-2 px-3">+500 pts, combo +1, maintains audio gain</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-[#00e5ff] font-bold">Perfect Hit</td>
                          <td className="py-2 px-3">&le; TimingWindow P</td>
                          <td className="py-2 px-3">+300 pts, combo +1, maintains audio gain</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-red-400 font-bold">Note Miss</td>
                          <td className="py-2 px-3">Note passes line without hit</td>
                          <td className="py-2 px-3">0 pts, resets combo, mutes lane audio to 0.04</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-[#a855f7] font-bold">Remix Note ⚡ Hit</td>
                          <td className="py-2 px-3">Hit Remix note with PERFECT timing</td>
                          <td className="py-2 px-3">Triggers Web Audio stem mutation, +1000 pts</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-red-500 font-bold">Signal Lost (Failure)</td>
                          <td className="py-2 px-3">Accumulate 3 misses</td>
                          <td className="py-2 px-3">Engine pauses, audio rewinds 2.5s</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-[#39ff14] font-bold">Drought Protection</td>
                          <td className="py-2 px-3">25 pulls without Rare+</td>
                          <td className="py-2 px-3">Next pull guarantees Rare or higher card</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: ULTRA REWARDS & BUFFS */}
            {activeTab === 'rewards' && (
              <div className="space-y-6">
                <section className="p-4 rounded-xl bg-[#b44dff]/10 border border-[#b44dff]/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={18} className="text-[#b44dff]" />
                    <h3 className="font-['Impact'] text-lg uppercase tracking-wide m-0 text-[#b44dff]">
                      0.3% Ultra Rewards
                    </h3>
                  </div>
                  <p className="font-mono text-[11px] leading-relaxed text-white/80 m-0">
                    Every card pulled from the Vault has an independent <strong className="text-white">0.3% chance</strong> to reveal an Ultra Reward hiding on its back face.
                    <br /><br />
                    Distinguished by a premium gold foil design, Ultra Rewards are globally capped and can be redeemed via the <strong className="text-[#39ff14]">Redeem (/vault/claim)</strong> tab for physical 1-of-1s, exclusive custom drops, or rare physical artifacts.
                  </p>
                </section>

                <section className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={18} className="text-[#00d4aa]" />
                    <h3 className="font-['Impact'] text-lg uppercase tracking-wide m-0 text-[#00d4aa]">
                      Active Forge Buffs
                    </h3>
                  </div>
                  
                  <p className="font-mono text-[10px] text-white/50 mb-3">
                    These global conditional modifiers automatically boost your drop rates or grant special bonuses based on your active gameplay context:
                  </p>

                  {modifiers.length === 0 ? (
                    <div className="text-center p-4 border border-white/5 bg-white/[0.02] rounded-lg">
                      <span className="font-mono text-[10px] text-white/30 uppercase">No active buffs right now.</span>
                    </div>
                  ) : (
                    <div className="grid gap-2.5">
                      {modifiers.map(mod => (
                        <div key={mod.id} className="p-3 rounded-lg border border-[#00d4aa]/20 bg-[#00d4aa]/5 flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="font-['JetBrains_Mono'] text-[11px] font-bold text-[#00d4aa] uppercase tracking-wider">
                              {mod.name}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-white/70 leading-relaxed">
                            {mod.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

          </div>

          {/* Footer Bar */}
          <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between font-mono text-[10px] text-white/40 shrink-0">
            <span>PIM FIELD OPERATING MANUAL // SYSTEM 2.1</span>
            <span className="text-[#39ff14] font-bold">CLICK PRINT BUTTON TO SAVE AS PDF</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
