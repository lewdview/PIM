import React from 'react';
import { motion } from 'framer-motion';

// ===== 1. TOP MARQUEE HEADER SVG =====
export function VendingMarqueeSVG() {
  return (
    <div className="relative w-full overflow-hidden rounded-t-3xl border-b-2 border-slate-800 bg-slate-950 p-4 shadow-2xl">
      <svg
        viewBox="0 0 1000 120"
        className="w-full h-auto max-h-24 drop-shadow-[0_0_15px_rgba(59,130,246,0.4)]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="marqueeBg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#070a12" />
            <stop offset="30%" stopColor="#0f172a" />
            <stop offset="50%" stopColor="#1e1b4b" />
            <stop offset="70%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#070a12" />
          </linearGradient>

          <linearGradient id="pimGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          <linearGradient id="pimBlue" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>

          <linearGradient id="neonPurple" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Background Base */}
        <rect width="1000" height="120" rx="12" fill="url(#marqueeBg)" />
        <rect width="1000" height="120" fill="url(#gridPattern)" />

        {/* Outer Frame Bezel */}
        <rect x="4" y="4" width="992" height="112" rx="10" fill="none" stroke="url(#pimBlue)" strokeWidth="2" opacity="0.6" />
        <rect x="8" y="8" width="984" height="104" rx="8" fill="none" stroke="#1e293b" strokeWidth="2" />

        {/* Decorative Corner Bolts */}
        <circle cx="20" cy="20" r="4" fill="#475569" stroke="#000" strokeWidth="1" />
        <circle cx="980" cy="20" r="4" fill="#475569" stroke="#000" strokeWidth="1" />
        <circle cx="20" cy="100" r="4" fill="#475569" stroke="#000" strokeWidth="1" />
        <circle cx="980" cy="100" r="4" fill="#475569" stroke="#000" strokeWidth="1" />

        {/* Left Audio Equalizer Waveform SVG */}
        <g transform="translate(40, 35)">
          <rect x="0" y="20" width="6" height="30" fill="#3b82f6" rx="3">
            <animate attributeName="height" values="15;40;20;35;15" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="y" values="27.5;15;25;17.5;27.5" dur="1.2s" repeatCount="indefinite" />
          </rect>
          <rect x="12" y="10" width="6" height="50" fill="#60a5fa" rx="3">
            <animate attributeName="height" values="30;15;45;20;30" dur="0.9s" repeatCount="indefinite" />
            <animate attributeName="y" values="20;27.5;12.5;25;20" dur="0.9s" repeatCount="indefinite" />
          </rect>
          <rect x="24" y="5" width="6" height="60" fill="#a855f7" rx="3">
            <animate attributeName="height" values="45;20;55;30;45" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="y" values="12.5;25;7.5;20;12.5" dur="1.5s" repeatCount="indefinite" />
          </rect>
          <rect x="36" y="15" width="6" height="40" fill="#fbbf24" rx="3">
            <animate attributeName="height" values="20;50;15;35;20" dur="1.1s" repeatCount="indefinite" />
            <animate attributeName="y" values="25;10;27.5;17.5;25" dur="1.1s" repeatCount="indefinite" />
          </rect>
        </g>

        {/* Right Audio Equalizer Waveform SVG */}
        <g transform="translate(900, 35)">
          <rect x="0" y="15" width="6" height="40" fill="#fbbf24" rx="3">
            <animate attributeName="height" values="20;45;15;35;20" dur="1.3s" repeatCount="indefinite" />
            <animate attributeName="y" values="25;12.5;27.5;17.5;25" dur="1.3s" repeatCount="indefinite" />
          </rect>
          <rect x="12" y="5" width="6" height="60" fill="#a855f7" rx="3">
            <animate attributeName="height" values="50;20;40;55;50" dur="1.0s" repeatCount="indefinite" />
            <animate attributeName="y" values="10;25;15;7.5;10" dur="1.0s" repeatCount="indefinite" />
          </rect>
          <rect x="24" y="10" width="6" height="50" fill="#60a5fa" rx="3">
            <animate attributeName="height" values="25;45;20;35;25" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="y" values="22.5;12.5;25;17.5;22.5" dur="1.4s" repeatCount="indefinite" />
          </rect>
          <rect x="36" y="20" width="6" height="30" fill="#3b82f6" rx="3">
            <animate attributeName="height" values="15;35;25;40;15" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="y" values="27.5;17.5;22.5;15;27.5" dur="0.8s" repeatCount="indefinite" />
          </rect>
        </g>

        {/* CENTER PIM EMBLEM & BRANDING */}
        <g transform="translate(500, 60)" textAnchor="middle">
          {/* Glowing Back Emblem Arc */}
          <circle cx="0" cy="0" r="42" fill="none" stroke="url(#neonPurple)" strokeWidth="2" strokeDasharray="6 4" filter="url(#glow)" opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="20s" repeatCount="indefinite" />
          </circle>

          {/* Vinyl Record Center Graphic */}
          <circle cx="0" cy="0" r="32" fill="#090d16" stroke="#334155" strokeWidth="2" />
          <circle cx="0" cy="0" r="26" fill="none" stroke="#1e293b" strokeWidth="1" />
          <circle cx="0" cy="0" r="20" fill="none" stroke="#1e293b" strokeWidth="1" />
          <circle cx="0" cy="0" r="12" fill="url(#pimGold)" />
          <circle cx="0" cy="0" r="4" fill="#000" />

          {/* Main Title Banner Text */}
          <text x="0" y="-12" fill="#ffffff" fontSize="28" fontWeight="900" fontFamily="Impact, sans-serif" letterSpacing="6" filter="url(#glow)">
            PIM <tspan fill="url(#pimGold)">:</tspan><tspan fill="url(#pimBlue)">:</tspan> TH3V4ULT
          </text>

          {/* Subtitle Badge */}
          <text x="0" y="24" fill="#94a3b8" fontSize="10" fontWeight="800" fontFamily="JetBrains Mono, monospace" letterSpacing="4">
            POETRY IN MOTION • VENDING MATRIX
          </text>
        </g>

        {/* Status Indicator Lights */}
        <g transform="translate(110, 45)">
          <circle cx="0" cy="0" r="5" fill="#10b981" filter="url(#glow)" />
          <text x="12" y="4" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="monospace">POWER</text>
        </g>
        <g transform="translate(110, 75)">
          <circle cx="0" cy="0" r="5" fill="#3b82f6" filter="url(#glow)" />
          <text x="12" y="4" fill="#60a5fa" fontSize="9" fontWeight="bold" fontFamily="monospace">MATRIX</text>
        </g>
      </svg>
    </div>
  );
}

// ===== 2. SIDE GRAPHIC PANELS (CYBERPUNK / STREET ART VENDING DECALS) =====
export function SidePanelGraphicSVG({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={`hidden lg:flex flex-col items-center justify-between w-16 bg-slate-950 border-2 border-slate-800 rounded-3xl p-2 relative overflow-hidden shadow-2xl shrink-0 ${
      side === 'left' ? 'mr-1' : 'ml-1'
    }`}>
      <svg className="w-full h-full min-h-[480px]" viewBox="0 0 60 500" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`sideGrad-${side}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Background Panel */}
        <rect width="60" height="500" rx="16" fill={`url(#sideGrad-${side})`} />
        <line x1="0" y1="0" x2="60" y2="500" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
        <line x1="60" y1="0" x2="0" y2="500" stroke="#a855f7" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />

        {/* Top Text */}
        <text 
          x="30" y="120" 
          writingMode="tb" 
          textAnchor="middle" 
          fill="#60a5fa" 
          fontSize="9" 
          fontWeight="900" 
          fontFamily="JetBrains Mono, monospace" 
          letterSpacing="4"
        >
          PIM • TH3SCR1B3
        </text>

        {/* Center Vinyl Graphic Badge */}
        <circle cx="30" cy="250" r="16" fill="#090d16" stroke="#a855f7" strokeWidth="1.5" />
        <circle cx="30" cy="250" r="10" fill="none" stroke="#334155" strokeWidth="1" />
        <circle cx="30" cy="250" r="4" fill="#fbbf24" />

        {/* Bottom Text */}
        <text 
          x="30" y="380" 
          writingMode="tb" 
          textAnchor="middle" 
          fill="#fbbf24" 
          fontSize="9" 
          fontWeight="900" 
          fontFamily="JetBrains Mono, monospace" 
          letterSpacing="4"
        >
          POETRY IN MOTION
        </text>
      </svg>
    </div>
  );
}

// ===== 3. METALLIC 3D VENDING COIL SVG (BEHIND EACH PACK) =====
export function VendingCoilSVG({ accent = '#3b82f6' }: { accent?: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-40">
      <svg viewBox="0 0 200 300" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`coilGrad-${accent.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#475569" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>

        {/* 3D Metal Spiral Wire Coil */}
        <g stroke={`url(#coilGrad-${accent.replace('#', '')})`} strokeWidth="12" fill="none" strokeLinecap="round">
          <path d="M 50 40 Q 150 20 150 60 Q 50 100 50 120 Q 150 140 150 180 Q 50 220 50 240 Q 150 260 100 280" />
        </g>
        <g stroke={accent} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6">
          <path d="M 50 40 Q 150 20 150 60 Q 50 100 50 120 Q 150 140 150 180 Q 50 220 50 240 Q 150 260 100 280" />
        </g>
      </svg>
    </div>
  );
}

// ===== 4. RETRIEVAL CHUTE FLAP DOOR SVG =====
export function RetrievalChuteDoorSVG({ hasItems }: { hasItems: boolean }) {
  return (
    <div className="w-full relative overflow-hidden rounded-2xl border-2 border-slate-700 bg-gradient-to-b from-slate-950 via-slate-900 to-black p-4 shadow-[inset_0_10px_30px_rgba(0,0,0,0.9)]">
      {/* Caution Stripe Banner Bar */}
      <div className="h-2 w-full mb-3 rounded-full overflow-hidden opacity-80" style={{
        background: 'repeating-linear-gradient(-45deg, #fbbf24, #fbbf24 10px, #0f172a 10px, #0f172a 20px)'
      }} />

      {/* Flap Door Mechanism Graphic */}
      <svg viewBox="0 0 800 60" className="w-full h-12" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="doorMetal" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>

        {/* Hinge Line */}
        <line x1="20" y1="6" x2="780" y2="6" stroke="#475569" strokeWidth="4" />
        <circle cx="40" cy="6" r="5" fill="#64748b" />
        <circle cx="760" cy="6" r="5" fill="#64748b" />

        {/* Main Flap Door Plate */}
        <rect x="25" y="10" width="750" height="44" rx="6" fill="url(#doorMetal)" stroke="#334155" strokeWidth="2" />

        {/* Embossed Brand Text */}
        <text x="400" y="38" textAnchor="middle" fill={hasItems ? "#fbbf24" : "#475569"} fontSize="14" fontWeight="900" fontFamily="Impact, sans-serif" letterSpacing="4">
          PIM :: PACK RETRIEVAL CHUTE
        </text>

        {/* Recessed Handle Bar */}
        <rect x="350" y="44" width="100" height="4" rx="2" fill="#64748b" />
      </svg>
    </div>
  );
}

// ===== 5. OVERHEAD ROBOTIC CLAW SVG (GRIPPING THE PACK FROM ABOVE) =====
export function OverheadClawSVG({ accent = '#3b82f6', isGrabbing = false }: { accent?: string; isGrabbing?: boolean }) {
  return (
    <div className="w-full flex flex-col items-center pointer-events-none z-20 mb-[-8px]">
      <svg viewBox="0 0 240 45" className="w-44 h-9" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="clawSteel" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>

        {/* Overhead Track Mounting Bar */}
        <rect x="20" y="0" width="200" height="6" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />

        {/* Conveyor Track Wheels */}
        <circle cx="60" cy="3" r="3" fill="#64748b" />
        <circle cx="180" cy="3" r="3" fill="#64748b" />

        {/* Central Motor Housing */}
        <rect x="95" y="6" width="50" height="16" rx="4" fill="url(#clawSteel)" stroke="#000" strokeWidth="1" />
        <circle cx="120" cy="14" r="3.5" fill={accent} />

        {/* Pneumatic Arm Pistons */}
        <rect x="102" y="22" width="5" height="12" fill="#64748b" />
        <rect x="133" y="22" width="5" height="12" fill="#64748b" />

        {/* Left Claw Finger */}
        <path
          d="M 98 34 Q 85 38 78 44"
          stroke="#94a3b8"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Right Claw Finger */}
        <path
          d="M 142 34 Q 155 38 162 44"
          stroke="#94a3b8"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ===== 6. CUSTOM SVG SHELF NAMEPLATE WITH CORRELATING COLOR PALETTE =====
export function VendingShelfNameplateSVG({ 
  categoryConfig, 
  pageIdx, 
  maxPages,
  onPrev,
  onNext,
  extraControls
}: { 
  categoryConfig: any; 
  pageIdx: number; 
  maxPages: number;
  onPrev?: () => void;
  onNext?: () => void;
  extraControls?: React.ReactNode;
}) {
  const accent = categoryConfig?.accent || '#a855f7';
  const label = categoryConfig?.label || 'SHELF';
  const icon = categoryConfig?.icon || '📦';
  const desc = categoryConfig?.description || '';

  return (
    <div className="w-full relative select-none mb-4 z-20">
      <div 
        className="w-full rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 p-3.5 shadow-2xl relative overflow-hidden transition-all duration-500"
        style={{
          borderColor: accent,
          boxShadow: `0 0 30px ${accent}40, inset 0 0 20px ${accent}15`,
        }}
      >
        {/* Subtle SVG Grid & Correlating Glow Pattern */}
        <svg viewBox="0 0 900 80" className="absolute inset-0 w-full h-full pointer-events-none opacity-25" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={`npGrad-${accent.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.8" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.3" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.8" />
            </linearGradient>
            <filter id={`npGlow-${accent.replace('#', '')}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Top & Bottom Industrial Metallic Bevel Lines */}
          <line x1="10" y1="6" x2="890" y2="6" stroke={`url(#npGrad-${accent.replace('#', '')})`} strokeWidth="2" filter={`url(#npGlow-${accent.replace('#', '')})`} />
          <line x1="10" y1="74" x2="890" y2="74" stroke={`url(#npGrad-${accent.replace('#', '')})`} strokeWidth="2" filter={`url(#npGlow-${accent.replace('#', '')})`} />

          {/* Hex Pattern */}
          <path d="M 0 20 L 900 20 M 0 40 L 900 40 M 0 60 L 900 60" stroke={accent} strokeWidth="0.5" strokeDasharray="6 6" opacity="0.3" />
          
          {/* Corner Rivets */}
          <circle cx="16" cy="16" r="3.5" fill="#475569" stroke="#000" strokeWidth="1" />
          <circle cx="884" cy="16" r="3.5" fill="#475569" stroke="#000" strokeWidth="1" />
          <circle cx="16" cy="64" r="3.5" fill="#475569" stroke="#000" strokeWidth="1" />
          <circle cx="884" cy="64" r="3.5" fill="#475569" stroke="#000" strokeWidth="1" />
        </svg>

        {/* Scanline CRT overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.4)_51%)] bg-[length:100%_4px] pointer-events-none opacity-30" />

        <div className="relative z-10 flex flex-wrap justify-between items-center gap-3">
          {/* Left: Navigation Buttons & Shelf Nameplate */}
          <div className="flex items-center gap-3">
            {onPrev && onNext && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onPrev}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border text-white font-mono text-[10px] font-black tracking-wider uppercase hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-md"
                  style={{ borderColor: `${accent}88`, color: accent }}
                  title="Previous Shelf (Left Arrow)"
                >
                  ◀ <span>PREV</span>
                </button>
                <button
                  onClick={onNext}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border text-white font-mono text-[10px] font-black tracking-wider uppercase hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-md"
                  style={{ borderColor: `${accent}88`, color: accent }}
                  title="Next Shelf (Right Arrow)"
                >
                  <span>NEXT</span> ▶
                </button>
              </div>
            )}

            {/* Main Correlating Color Badge */}
            <div className="flex items-center gap-3">
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 border-2 shadow-lg transition-transform duration-300 hover:scale-110"
                style={{
                  backgroundColor: `${accent}22`,
                  borderColor: accent,
                  boxShadow: `0 0 20px ${accent}66`,
                }}
              >
                {icon}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-extrabold uppercase tracking-[0.2em]" style={{ color: accent }}>
                    SHELF 0{pageIdx + 1} / 0{maxPages} • NAMEPLATE
                  </span>
                  <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: accent }} />
                </div>
                
                <h3 
                  className="text-base sm:text-lg font-mono font-black uppercase tracking-wider flex items-center gap-2 drop-shadow-md"
                  style={{ color: '#ffffff' }}
                >
                  <span style={{ color: accent }}>{label}</span>
                  {desc && (
                    <span className="text-xs font-normal text-slate-400 font-mono hidden md:inline">
                      ({desc})
                    </span>
                  )}
                </h3>
              </div>
            </div>
          </div>

          {/* Right: Extra Controls (e.g. Artwork Theme Switcher) or Metric Pills */}
          <div className="flex items-center gap-2">
            {extraControls}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 6. DIGITAL CARD TYPE INSPECTOR DISPLAY WINDOW SVG =====
export function VendingInspectorWindowSVG({ categoryConfig, pageIdx, maxPages }: { categoryConfig: any; pageIdx: number; maxPages: number }) {
  return (
    <VendingShelfNameplateSVG 
      categoryConfig={categoryConfig}
      pageIdx={pageIdx}
      maxPages={maxPages}
    />
  );
}

// ===== 7. ARCADE COIN MECHANISM SLOT SVG =====
export function VendingCoinSlotSVG() {
  return (
    <div className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-3 relative overflow-hidden shadow-xl select-none">
      <svg viewBox="0 0 300 90" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="coinPlateMetal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="50%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>

        {/* Outer Metal Plate */}
        <rect x="5" y="5" width="290" height="80" rx="10" fill="url(#coinPlateMetal)" stroke="#475569" strokeWidth="2" />
        
        {/* Corner Rivets */}
        <circle cx="18" cy="18" r="3" fill="#64748b" />
        <circle cx="282" cy="18" r="3" fill="#64748b" />
        <circle cx="18" cy="72" r="3" fill="#64748b" />
        <circle cx="282" cy="72" r="3" fill="#64748b" />

        {/* Illuminated Token Slot Slit */}
        <g transform="translate(30, 20)">
          <rect x="0" y="0" width="10" height="50" rx="3" fill="#020617" stroke="#10b981" strokeWidth="1.5" />
          <rect x="3" y="5" width="4" height="40" rx="2" fill="#10b981" className="animate-pulse" />
          <text x="16" y="24" fill="#10b981" fontSize="9" fontWeight="900" fontFamily="monospace" letterSpacing="1">INSERT</text>
          <text x="16" y="36" fill="#10b981" fontSize="9" fontWeight="900" fontFamily="monospace" letterSpacing="1">TOKEN</text>
        </g>

        {/* Coin Return Reject Button */}
        <g transform="translate(130, 22)">
          <rect x="0" y="0" width="45" height="45" rx="8" fill="#ef4444" stroke="#991b1b" strokeWidth="2" />
          <text x="22.5" y="27" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900" fontFamily="monospace">REJECT</text>
        </g>

        {/* Digital Credit Ledger Screen */}
        <g transform="translate(195, 20)">
          <rect x="0" y="0" width="80" height="50" rx="6" fill="#020617" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="40" y="20" textAnchor="middle" fill="#60a5fa" fontSize="8" fontWeight="bold" fontFamily="monospace">CREDITS</text>
          <text x="40" y="40" textAnchor="middle" fill="#fbbf24" fontSize="18" fontWeight="900" fontFamily="Impact, monospace">99</text>
        </g>
      </svg>
    </div>
  );
}

// ===== 8. ARCADE MATRIX KEYPAD SVG =====
export function VendingKeypadSVG({ pageIdx, onLeverPull }: { pageIdx: number; onLeverPull: () => void }) {
  return (
    <div className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-3 relative overflow-hidden shadow-xl select-none">
      <div className="flex flex-col gap-2">
        {/* Screen Readout */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 flex items-center justify-between text-[10px] font-mono">
          <span className="text-purple-400 font-extrabold">SHELF KEYPAD</span>
          <span className="text-amber-400 font-extrabold animate-pulse">[ SHELF 0{pageIdx + 1} ACTIVE ]</span>
        </div>

        {/* Matrix Arcade Keys */}
        <div className="grid grid-cols-3 gap-1.5">
          {['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'NEXT'].map((keyLabel) => {
            const isNext = keyLabel === 'NEXT';
            return (
              <button
                key={keyLabel}
                onClick={onLeverPull}
                className={`py-2 rounded-lg font-mono text-[10px] font-extrabold tracking-wider border transition-all active:scale-95 shadow-md ${
                  isNext
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-300 text-black col-span-3'
                    : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-purple-500 hover:text-purple-300'
                }`}
              >
                {isNext ? '🔄 NEXT CATEGORY SHELF ➔' : keyLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
