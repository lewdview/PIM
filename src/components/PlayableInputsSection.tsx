import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Gamepad2, MousePointer, Keyboard, Sparkles, CheckCircle2 } from 'lucide-react';
import { audioManager } from '../game/audio';

// ===== 1. TOUCH INPUT CUSTOM SVG GRAPHIC =====
export function TouchInputSVG({ accent = '#10b981' }: { accent?: string }) {
  return (
    <svg viewBox="0 0 240 180" className="w-full h-auto drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="touchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#022c22" stopOpacity="0.8" />
        </linearGradient>
        <filter id="touchGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Smartphone Frame */}
      <rect x="35" y="15" width="170" height="150" rx="20" fill="url(#touchGrad)" stroke={accent} strokeWidth="2.5" />
      <rect x="42" y="22" width="156" height="136" rx="14" fill="#020617" stroke="#1e293b" strokeWidth="1.5" />

      {/* Screen Notch & Speaker */}
      <rect x="100" y="26" width="40" height="4" rx="2" fill="#334155" />

      {/* 3 Rhythm Lanes On Display */}
      <line x1="94" y1="35" x2="94" y2="145" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="4 4" />
      <line x1="146" y1="35" x2="146" y2="145" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="4 4" />

      {/* Touch Tap Target 1 (Pulse Ripple) */}
      <circle cx="68" cy="115" r="22" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.4" className="animate-ping" />
      <circle cx="68" cy="115" r="16" fill={`${accent}33`} stroke={accent} strokeWidth="2.5" filter="url(#touchGlow)" />
      <circle cx="68" cy="115" r="6" fill={accent} />

      {/* Touch Tap Target 2 */}
      <circle cx="120" cy="95" r="16" fill="none" stroke={accent} strokeWidth="2" strokeDasharray="4 2" />
      <circle cx="120" cy="95" r="6" fill={accent} opacity="0.8" />

      {/* Touch Tap Target 3 */}
      <circle cx="172" cy="120" r="18" fill={`${accent}22`} stroke={accent} strokeWidth="2" />
      <circle cx="172" cy="120" r="7" fill={accent} />

      {/* Haptic Vibration Wave Arcs */}
      <path d="M 18 80 Q 24 90 18 100" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <path d="M 10 70 Q 20 90 10 110" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.5" />

      <path d="M 222 80 Q 216 90 222 100" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <path d="M 230 70 Q 220 90 230 110" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.5" />

      {/* Hand Touch Finger Silhouette Indicator */}
      <g transform="translate(56, 100)">
        <path d="M 20 35 L 20 18 Q 20 12 15 12 Q 10 12 10 18 L 10 35" fill="#38bdf8" opacity="0.9" />
      </g>
    </svg>
  );
}

// ===== 2. CONTROLLER / GAMEPAD CUSTOM SVG GRAPHIC =====
export function ControllerInputSVG({ accent = '#a855f7' }: { accent?: string }) {
  return (
    <svg viewBox="0 0 240 180" className="w-full h-auto drop-shadow-[0_0_20px_rgba(168,85,247,0.3)]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="padGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4c1d95" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
        </linearGradient>
        <filter id="padGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Gamepad Body Silhouette */}
      <path
        d="M 50 45 C 70 40, 170 40, 190 45 C 220 50, 230 110, 205 150 C 190 170, 165 155, 150 125 C 135 115, 105 115, 90 125 C 75 155, 50 170, 35 150 C 10 110, 20 50, 50 45 Z"
        fill="url(#padGrad)"
        stroke={accent}
        strokeWidth="2.5"
      />

      {/* Bumper Shoulder Triggers L1/R1 */}
      <rect x="45" y="30" width="40" height="12" rx="4" fill="#1e293b" stroke={accent} strokeWidth="1.5" />
      <rect x="155" y="30" width="40" height="12" rx="4" fill="#1e293b" stroke={accent} strokeWidth="1.5" />

      {/* Left D-Pad Cross */}
      <g transform="translate(60, 70)">
        <rect x="12" y="0" width="10" height="34" rx="2" fill="#1e293b" stroke={accent} strokeWidth="1.5" />
        <rect x="0" y="12" width="34" height="10" rx="2" fill="#1e293b" stroke={accent} strokeWidth="1.5" />
        <polygon points="17,3 13,8 21,8" fill={accent} />
        <polygon points="17,31 13,26 21,26" fill={accent} />
        <polygon points="3,17 8,13 8,21" fill={accent} />
        <polygon points="31,17 26,13 26,21" fill={accent} />
      </g>

      {/* Right Action Face Buttons (X, Y, A, B) */}
      <g transform="translate(170, 87)">
        {/* Top Button Y */}
        <circle cx="0" cy="-18" r="7.5" fill="#020617" stroke="#fbbf24" strokeWidth="2" />
        <text x="0" y="-15" textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="900" fontFamily="sans-serif">Y</text>

        {/* Left Button X */}
        <circle cx="-18" cy="0" r="7.5" fill="#020617" stroke="#38bdf8" strokeWidth="2" />
        <text x="-18" y="3" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="900" fontFamily="sans-serif">X</text>

        {/* Right Button B */}
        <circle cx="18" cy="0" r="7.5" fill="#020617" stroke="#ef4444" strokeWidth="2" />
        <text x="18" y="3" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="900" fontFamily="sans-serif">B</text>

        {/* Bottom Button A */}
        <circle cx="0" cy="18" r="7.5" fill={`${accent}44`} stroke={accent} strokeWidth="2" filter="url(#padGlow)" />
        <text x="0" y="21" textAnchor="middle" fill={accent} fontSize="9" fontWeight="900" fontFamily="sans-serif">A</text>
      </g>

      {/* Dual Thumbstick Caps */}
      <circle cx="100" cy="100" r="14" fill="#0f172a" stroke="#334155" strokeWidth="2" />
      <circle cx="100" cy="100" r="8" fill="#1e293b" stroke={accent} strokeWidth="1" />

      <circle cx="140" cy="100" r="14" fill="#0f172a" stroke="#334155" strokeWidth="2" />
      <circle cx="140" cy="100" r="8" fill="#1e293b" stroke={accent} strokeWidth="1" />

      {/* Center Home / Status LED */}
      <circle cx="120" cy="70" r="5" fill={accent} filter="url(#padGlow)" />
    </svg>
  );
}

// ===== 3. MOUSE & TRACKPAD CUSTOM SVG GRAPHIC =====
export function MouseInputSVG({ accent = '#fbbf24' }: { accent?: string }) {
  return (
    <svg viewBox="0 0 240 180" className="w-full h-auto drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mouseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#78350f" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
        </linearGradient>
        <filter id="mouseGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Gaming Mouse Silhouette */}
      <rect x="75" y="25" width="90" height="135" rx="42" fill="url(#mouseGrad)" stroke={accent} strokeWidth="2.5" />

      {/* Left & Right Clicker Split Seam */}
      <line x1="120" y1="25" x2="120" y2="70" stroke={accent} strokeWidth="2" />

      {/* Left Click Active Zone */}
      <path d="M 76 65 L 76 55 C 76 38, 90 26, 118 26 L 118 65 Z" fill={`${accent}33`} stroke={accent} strokeWidth="1.5" />

      {/* Scroll Wheel */}
      <rect x="114" y="40" width="12" height="22" rx="6" fill="#020617" stroke={accent} strokeWidth="2" filter="url(#mouseGlow)" />
      <line x1="120" y1="44" x2="120" y2="58" stroke={accent} strokeWidth="2" strokeDasharray="2 2" />

      {/* Thumb Side Grip Ribs */}
      <line x1="72" y1="80" x2="72" y2="110" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <line x1="66" y1="85" x2="66" y2="105" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.5" />

      {/* Illuminated Palm Emblem */}
      <polygon points="120,95 128,110 112,110" fill={accent} opacity="0.8" filter="url(#mouseGlow)" />
      <circle cx="120" cy="125" r="4" fill={accent} />

      {/* Precision Cursor Pointer Vector */}
      <g transform="translate(150, 60)">
        <polygon points="0,0 24,10 14,14 10,24" fill={accent} stroke="#000" strokeWidth="1.5" filter="url(#mouseGlow)" />
        <circle cx="0" cy="0" r="14" fill="none" stroke={accent} strokeWidth="1.5" strokeDasharray="3 3" className="animate-spin" />
      </g>
    </svg>
  );
}

// ===== 4. MECHANICAL KEYBOARD CUSTOM SVG GRAPHIC =====
export function KeyboardInputSVG({ accent = '#38bdf8' }: { accent?: string }) {
  return (
    <svg viewBox="0 0 240 180" className="w-full h-auto drop-shadow-[0_0_20px_rgba(56,189,248,0.3)]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="kbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0c4a6e" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
        </linearGradient>
        <filter id="kbGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Mechanical Switch Plate Base Frame */}
      <rect x="20" y="30" width="200" height="120" rx="16" fill="url(#kbGrad)" stroke={accent} strokeWidth="2.5" />

      {/* 4 Mechanical Keycaps Matrix ([D] [F] [J] [K]) */}

      {/* Key 1: D */}
      <g transform="translate(35, 45)">
        <rect x="0" y="0" width="38" height="38" rx="8" fill="#020617" stroke="#334155" strokeWidth="2" />
        <rect x="4" y="4" width="30" height="26" rx="5" fill="#1e293b" stroke="#475569" strokeWidth="1" />
        <text x="19" y="23" textAnchor="middle" fill="#94a3b8" fontSize="14" fontWeight="900" fontFamily="monospace">D</text>
      </g>

      {/* Key 2: F (Pressed / Active Key Glow) */}
      <g transform="translate(80, 48)">
        <rect x="0" y="0" width="38" height="38" rx="8" fill={`${accent}33`} stroke={accent} strokeWidth="2.5" filter="url(#kbGlow)" />
        <rect x="4" y="4" width="30" height="26" rx="5" fill="#0f172a" stroke={accent} strokeWidth="1.5" />
        <text x="19" y="23" textAnchor="middle" fill={accent} fontSize="15" fontWeight="900" fontFamily="monospace">F</text>
        <circle cx="19" cy="30" r="2" fill={accent} />
      </g>

      {/* Key 3: J (Pressed / Active Key Glow) */}
      <g transform="translate(125, 48)">
        <rect x="0" y="0" width="38" height="38" rx="8" fill={`${accent}33`} stroke={accent} strokeWidth="2.5" filter="url(#kbGlow)" />
        <rect x="4" y="4" width="30" height="26" rx="5" fill="#0f172a" stroke={accent} strokeWidth="1.5" />
        <text x="19" y="23" textAnchor="middle" fill={accent} fontSize="15" fontWeight="900" fontFamily="monospace">J</text>
        <circle cx="19" cy="30" r="2" fill={accent} />
      </g>

      {/* Key 4: K */}
      <g transform="translate(170, 45)">
        <rect x="0" y="0" width="38" height="38" rx="8" fill="#020617" stroke="#334155" strokeWidth="2" />
        <rect x="4" y="4" width="30" height="26" rx="5" fill="#1e293b" stroke="#475569" strokeWidth="1" />
        <text x="19" y="23" textAnchor="middle" fill="#94a3b8" fontSize="14" fontWeight="900" fontFamily="monospace">K</text>
      </g>

      {/* Number Row Alternative Binds Bar ([1] [2] [3]) */}
      <g transform="translate(35, 96)">
        <rect x="0" y="0" width="173" height="32" rx="8" fill="#090d16" stroke="#1e293b" strokeWidth="1.5" />
        <text x="15" y="20" fill="#64748b" fontSize="10" fontWeight="bold" fontFamily="monospace">ALT BIND:</text>
        <text x="75" y="20" fill={accent} fontSize="11" fontWeight="900" fontFamily="monospace">[1]</text>
        <text x="108" y="20" fill={accent} fontSize="11" fontWeight="900" fontFamily="monospace">[2]</text>
        <text x="141" y="20" fill={accent} fontSize="11" fontWeight="900" fontFamily="monospace">[3]</text>
      </g>

      {/* Mechanical Switch Stem Icon Badge */}
      <circle cx="120" cy="142" r="4" fill={accent} filter="url(#kbGlow)" />
    </svg>
  );
}

// ===== PLAYABLE INPUT MODES SHOWCASE SECTION COMPONENT =====
export default function PlayableInputsSection() {
  const [activeTab, setActiveTab] = useState<'all' | 'touch' | 'controller' | 'mouse' | 'keyboard'>('all');

  const INPUT_MODES = [
    {
      id: 'touch',
      title: 'TOUCH SCREENS',
      subtitle: 'Mobile Multi-Touch & Haptics',
      badge: 'iOS & ANDROID',
      accent: '#10b981',
      bgGlow: 'rgba(16,185,129,0.15)',
      icon: Smartphone,
      component: TouchInputSVG,
      desc: 'Seamless multi-finger tap & directional swipe gestures tuned for iPhone, iPad, and Android mobile screens with tactile haptic feedback.',
      features: ['Multi-touch lane strikes', 'Directional swipe notes', 'Zero-install mobile web', 'Native haptic vibration'],
    },
    {
      id: 'controller',
      title: 'GAMEPAD & ARCADE',
      subtitle: 'Controllers & Fightsticks',
      badge: 'BLUETOOTH & USB',
      accent: '#a855f7',
      bgGlow: 'rgba(168,85,247,0.15)',
      icon: Gamepad2,
      component: ControllerInputSVG,
      desc: 'Plug and play arcade controller support! Full native gamepad compatibility for Xbox, PlayStation DualSense, and custom rhythm fightsticks.',
      features: ['Instant gamepad auto-detect', 'Custom D-Pad & Trigger maps', 'Sub-millisecond polling', 'Tactile button glyphs'],
    },
    {
      id: 'mouse',
      title: 'PRECISION MOUSE',
      subtitle: 'Point-and-Click & Trackpad',
      badge: 'DESKTOP & LAPTOP',
      accent: '#fbbf24',
      bgGlow: 'rgba(251,191,36,0.15)',
      icon: MousePointer,
      component: MouseInputSVG,
      desc: 'High-precision cursor strikes for desktop & trackpad players. Fast click response and smooth trackpad drag gestures.',
      features: ['High DPI cursor tracking', 'Click & drag note holds', 'Adjustable pointer speed', 'Trackpad gesture support'],
    },
    {
      id: 'keyboard',
      title: 'MECHANICAL KEYBOARD',
      subtitle: 'Rebindable Lane Keys',
      badge: 'D F J K / 1 2 3',
      accent: '#38bdf8',
      bgGlow: 'rgba(56,189,248,0.15)',
      icon: Keyboard,
      component: KeyboardInputSVG,
      desc: 'Ultra-low latency mechanical key input. Complete keybind customization ([D,F,J,K] or [1,2,3]) with audio offset latency calibration.',
      features: ['Custom rebindable keys', 'N-key rollover anti-ghosting', 'Audio offset calibration (ms)', 'BPM note generation source'],
    },
  ];

  const filteredModes = activeTab === 'all' ? INPUT_MODES : INPUT_MODES.filter(m => m.id === activeTab);

  return (
    <section className="relative py-20 px-6 max-w-7xl mx-auto z-10" id="playable-controls">
      {/* Header Title */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 font-mono text-[10px] font-black uppercase tracking-[0.25em] mb-3 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
        >
          <Sparkles size={12} className="text-amber-400" />
          <span>PLAYABLE YOUR WAY • 100% CROSS-PLATFORM</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-sans"
        >
          Every Way To Play PIM
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.7 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-3 text-slate-400 font-mono text-xs sm:text-sm max-w-2xl mx-auto uppercase tracking-wider"
        >
          Touch on mobile, hit keybinds on keyboard, connect an arcade gamepad, or click with precision mouse. Zero downloads needed.
        </motion.p>

        {/* Input Mode Selector Filter Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <button
            onClick={() => {
              audioManager.playSfx('tap_nav', 0.15);
              setActiveTab('all');
            }}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer ${
              activeTab === 'all'
                ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            SHOW ALL (4 MODES)
          </button>

          {INPUT_MODES.map((m) => {
            const IconComp = m.icon;
            const isSel = activeTab === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  audioManager.playSfx('tap_nav', 0.15);
                  setActiveTab(m.id as any);
                }}
                className={`px-3.5 py-2 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all border flex items-center gap-1.5 cursor-pointer ${
                  isSel
                    ? 'bg-slate-900 text-white shadow-lg border-2'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                style={{
                  borderColor: isSel ? m.accent : undefined,
                  boxShadow: isSel ? `0 0 15px ${m.accent}66` : undefined,
                }}
              >
                <IconComp size={14} style={{ color: m.accent }} />
                <span>{m.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Display of 4 Input Method Cards */}
      <div className={`grid ${filteredModes.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'} gap-6`}>
        {filteredModes.map((mode, idx) => {
          const SVGComp = mode.component;
          const IconComp = mode.icon;

          return (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.12 }}
              onMouseEnter={() => audioManager.playSfx('tap_nav', 0.1)}
              className="relative group rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-950 to-black p-5 flex flex-col justify-between overflow-hidden shadow-2xl hover:border-slate-700 transition-all duration-300 hover:scale-[1.02]"
              style={{
                boxShadow: `0 10px 40px rgba(0,0,0,0.8), inset 0 0 20px ${mode.bgGlow}`,
              }}
            >
              {/* Top Accent Line */}
              <div
                className="absolute inset-x-0 top-0 h-1 transition-all group-hover:h-1.5"
                style={{ background: mode.accent }}
              />

              <div>
                {/* Mode Header Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="p-2.5 rounded-2xl border flex items-center justify-center shrink-0 shadow-lg"
                    style={{
                      backgroundColor: `${mode.accent}15`,
                      borderColor: `${mode.accent}55`,
                    }}
                  >
                    <IconComp size={20} style={{ color: mode.accent }} />
                  </div>

                  <span
                    className="px-2.5 py-1 rounded-lg font-mono text-[9px] font-extrabold uppercase tracking-widest border"
                    style={{
                      backgroundColor: `${mode.accent}10`,
                      borderColor: `${mode.accent}40`,
                      color: mode.accent,
                    }}
                  >
                    {mode.badge}
                  </span>
                </div>

                {/* Custom Vector SVG Graphic Illustration */}
                <div className="relative my-2 p-3 rounded-2xl bg-black/60 border border-slate-800/80 flex items-center justify-center overflow-hidden group-hover:border-slate-700 transition-colors">
                  <SVGComp accent={mode.accent} />
                </div>

                {/* Title & Description */}
                <h3 className="text-lg font-mono font-black text-white uppercase tracking-wider mt-3">
                  {mode.title}
                </h3>
                <p className="text-[11px] font-mono text-purple-300/80 font-bold uppercase tracking-wider mb-2">
                  {mode.subtitle}
                </p>

                <p className="text-xs text-slate-400 font-sans leading-relaxed mb-4">
                  {mode.desc}
                </p>
              </div>

              {/* Feature Checklist Bullets */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-1.5">
                {mode.features.map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-center gap-2 text-[10px] font-mono text-slate-300">
                    <CheckCircle2 size={12} style={{ color: mode.accent }} className="shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
