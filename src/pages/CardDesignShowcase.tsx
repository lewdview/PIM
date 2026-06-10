import { useState } from 'react';
import type { VaultCard } from '../services/vaultService';
import type { Rarity } from '../utils/rarity';
import { Volume2, Play, ChevronLeft, Layers, Zap, Flame, RotateCcw } from 'lucide-react';
import '../styles/CardShowcaseStyles.css';

// --------------------------------------------------------------------------
// MOCK DATA GENERATION
// --------------------------------------------------------------------------
const mockCards: VaultCard[] = [
  {
    id: 'mock-common',
    day: 3,
    title: "You Like Steve Earle",
    storageTitle: "You Like Steve Earle",
    mood: 'dark',
    rarity: 'common',
    energy: 0.418,
    valence: 0.468,
    tempo: 108,
    genre: ["Alternative", "Indie"],
    tags: ["reflective", "hopeful"],
    coverUrl: "https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/covers/january/03%20-%20You%20Like%20Steve%20Earle.jpg",
    audioUrl: "",
    description: "Exploring relationship dynamics and search for clarity.",
    claimedCount: 242,
    maxSupply: 1000,
  },
  {
    id: 'mock-uncommon',
    day: 1,
    title: "We're Going Crazy World",
    storageTitle: "Were Going Crazy World",
    mood: 'dark',
    rarity: 'uncommon',
    energy: 0.443,
    valence: 0.406,
    tempo: 161,
    genre: ["Alternative", "Indie"],
    tags: ["chaotic", "hazy"],
    coverUrl: "https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/covers/january/01%20-%20Were%20Going%20Crazy%20World.jpg",
    audioUrl: "",
    description: "Exploring mental health and self-discovery.",
    claimedCount: 145,
    maxSupply: 500,
  },
  {
    id: 'mock-rare',
    day: 13,
    title: "Dashboard of Life",
    storageTitle: "Dashboard of Life",
    mood: 'dark',
    rarity: 'rare',
    energy: 0.477,
    valence: 0.521,
    tempo: 99,
    genre: ["Alternative", "Indie"],
    tags: ["reflective", "introspective"],
    coverUrl: "https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/covers/january/13%20-%20Dashboard%20of%20Life.jpg",
    audioUrl: "",
    description: "Exploring personal growth and self-reflection.",
    claimedCount: 22,
    maxSupply: 50,
  },
  {
    id: 'mock-legendary',
    day: 42,
    title: "Prophecy of the Warp",
    storageTitle: "Prophecy of the Warp",
    mood: 'light',
    rarity: 'legendary',
    energy: 0.85,
    valence: 0.72,
    tempo: 128,
    genre: ["Outrun", "Synthwave"],
    tags: ["cyberpunk", "intense"],
    coverUrl: "https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/covers/january/14%20-%20Undercoa%204.jpg",
    audioUrl: "",
    description: "A legendary descent into the digital grid.",
    claimedCount: 3,
    maxSupply: 5,
  },
  {
    id: 'mock-mythic',
    day: 100,
    title: "Afterlife (Special)",
    storageTitle: "Afterlife Title Track",
    mood: 'dark',
    rarity: 'mythic',
    energy: 0.99,
    valence: 0.89,
    tempo: 174,
    genre: ["Cyberpunk", "Industrial"],
    tags: ["god-mode", "glitch"],
    coverUrl: "https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/covers/january/02%20-%20Shhh%20Bitch.jpg",
    audioUrl: "",
    description: "The ultimate track that bridges mortality and the net.",
    claimedCount: 1,
    maxSupply: 1,
  }
];

// Helper to format supply info
const getRarityMaxSupply = (r: Rarity) => {
  if (r === 'mythic') return 1;
  if (r === 'legendary') return 5;
  if (r === 'rare') return 50;
  if (r === 'uncommon') return 500;
  return 1000;
};

const RARITY_COLORS: Record<Rarity, string> = {
  common: '#8a8ea0',
  uncommon: '#4ade80',
  rare: '#3b82f6',
  legendary: '#b44dff',
  mythic: '#ffd700',
};

// --------------------------------------------------------------------------
// PRODUCTION-MATCHING STANDARD VAULT CARD BACK COMPONENT
// --------------------------------------------------------------------------
function PimLogo({ color, cardId }: { color: string; cardId: string }) {
  return (
    <svg width="64" height="64" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`pimGrad-${cardId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <text
        x="60"
        y="68"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={`url(#pimGrad-${cardId})`}
        fontFamily="'Impact', 'Arial Black', 'Helvetica Neue', sans-serif"
        fontSize="85"
        fontWeight="900"
        letterSpacing="-4"
        stroke="#000000"
        strokeWidth="7"
        strokeLinejoin="miter"
        paintOrder="stroke fill"
        style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
      >
        PIM
      </text>
    </svg>
  );
}

function StandardVaultCardBack({ card }: { card: VaultCard }) {
  const rcColor = RARITY_COLORS[card.rarity];
  const pulseRarity = ['rare', 'legendary', 'mythic'].includes(card.rarity);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Base Dark Cover */}
      <div className="absolute inset-0 bg-[#0c0a07]" />

      {/* Rarity-tinted radial glow */}
      <div 
        className="card-back-radial-glow absolute inset-0" 
        style={{ background: `radial-gradient(ellipse at 50% 40%, ${rcColor}14, transparent 65%)` }} 
      />

      {/* Animated sweeps for high rarities */}
      {card.rarity === 'mythic' && <div className="card-back-foil-sweep" />}
      {card.rarity === 'legendary' && <div className="card-back-foil-sweep" style={{ opacity: 0.6 }} />}

      {/* Diamond grid SVG */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.055]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`bp-${card.id}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M11 0L22 11L11 22L0 11Z" fill="none" stroke={rcColor} strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#bp-${card.id})`} />
      </svg>

      {/* Inner double frames */}
      <div 
        className="absolute inset-3 border rounded-lg" 
        style={{ borderColor: `${rcColor}22` }}
      >
        <div 
          className="absolute inset-1.5 border rounded" 
          style={{ borderColor: `${rcColor}10` }}
        >
          {/* Center emblem */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            
            {/* V mark frame */}
            <div className="relative">
              <div 
                className="w-16 h-16 rounded-full border-2 flex items-center justify-center overflow-hidden"
                style={{
                  background: `linear-gradient(145deg, ${rcColor}18, transparent)`,
                  borderColor: `${rcColor}30`,
                  boxShadow: `0 0 30px ${rcColor}10, inset 0 0 16px ${rcColor}05`,
                }}
              >
                <PimLogo color={rcColor} cardId={card.id} />
              </div>
              
              {pulseRarity && (
                <div 
                  className="center-ring-pulsing" 
                  style={{ background: `radial-gradient(circle, ${rcColor}12, transparent 70%)` }} 
                />
              )}
            </div>

            {/* Branding Details */}
            <div className="text-center flex flex-col gap-1 items-center">
              <span 
                className="font-bold text-[10px] uppercase tracking-[0.35em]"
                style={{ color: rcColor, textShadow: `0 0 10px ${rcColor}40` }}
              >
                th3v4ult
              </span>
              <div className="w-10 h-[1px]" style={{ background: `${rcColor}30` }} />
              <span className="text-[7.5px] uppercase tracking-wider text-[#fff0d8]/40">
                GEN 0 · {card.rarity.toUpperCase()}
              </span>
            </div>

            {/* Day pill */}
            <div 
              className="px-5 py-1.5 border rounded-full"
              style={{
                borderColor: `${rcColor}22`,
                background: `${rcColor}06`
              }}
            >
              <span className="font-bold text-[9px] tracking-widest" style={{ color: rcColor }}>
                #{String(card.day).padStart(3, '0')}
              </span>
            </div>

          </div>

          {/* Corner borders */}
          {[{t:true,l:true},{t:true,l:false},{t:false,l:true},{t:false,l:false}].map(({t,l},i) => (
            <div key={i} style={{
              position: 'absolute', width: '12px', height: '12px',
              top: t ? '6px' : undefined, bottom: !t ? '6px' : undefined,
              left: l ? '6px' : undefined, right: !l ? '6px' : undefined,
              borderTop:    t ? `1px solid ${rcColor}25` : 'none',
              borderBottom: !t ? `1px solid ${rcColor}25` : 'none',
              borderLeft:   l ? `1px solid ${rcColor}25` : 'none',
              borderRight:  !l ? `1px solid ${rcColor}25` : 'none',
            }} />
          ))}

        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 3D FLIP CONTAINER WRAPPER
// --------------------------------------------------------------------------
interface CardWrapperProps {
  rarity: Rarity;
  themeClass: string;
  children: React.ReactNode;
  backSide: React.ReactNode;
}

function Card3DWrapper({ rarity, themeClass, children, backSide }: CardWrapperProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="card-wrapper-3d" onClick={() => setIsFlipped(!isFlipped)}>
      <div className={`card-inner-3d ${isFlipped ? 'flipped' : ''}`}>
        <div className={`card-face-front theme-${themeClass} rarity-${rarity}`}>
          {children}
        </div>
        <div className={`card-face-back theme-${themeClass} rarity-${rarity}`}>
          {backSide}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// THEMATIC CARD BACK COMPONENTS
// --------------------------------------------------------------------------
function BackOriginal({ card }: { card: VaultCard }) {
  return <StandardVaultCardBack card={card} />;
}

// Custom SVG Icons for Card Backs & Designs
function GlitchIcon({ color, accentColor, cardId }: { color: string; accentColor: string; cardId: string }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" className="animate-pulse" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color }}>
      <path d="M5 3H3v18h2M19 3h2v18h-2" stroke={accentColor} strokeWidth="2" />
      <rect x="8" y="7" width="8" height="10" rx="1.5" stroke={color} fill="rgba(0,0,0,0.4)" />
      <path d="M12 9v3M10 14h4" stroke={color} />
      <circle cx="12" cy="12" r="1" fill={accentColor} />
      <path d="M12 4V2M12 22v-2M2 12h2M22 12h-2" stroke={color} opacity="0.3" />
    </svg>
  );
}

function GlassIcon({ cardId }: { cardId: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`glassGrad-${cardId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#c44dff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#00d4aa" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path d="M12 2L22 12L12 22L2 12Z" stroke={`url(#glassGrad-${cardId})`} strokeWidth="1.5" fill="rgba(255,255,255,0.03)" />
      <path d="M12 6L18 12L12 18L6 12Z" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <circle cx="12" cy="12" r="2" fill="#ffffff" />
    </svg>
  );
}

function ArcadeIcon() {
  return (
    <svg width="40" height="28" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="22" height="14" rx="3" stroke="#00f0ff" strokeWidth="1.5" fill="rgba(0,0,0,0.85)" />
      <path d="M5 8h4M7 6v4" stroke="#ff007f" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="15.5" cy="8" r="1.5" fill="#ff007f" />
      <circle cx="18.5" cy="8" r="1.5" fill="#00f0ff" />
      <line x1="11" y1="10" x2="13" y2="10" stroke="#ffffff" strokeWidth="1" />
    </svg>
  );
}

function MtgSigil({ cardId }: { cardId: string }) {
  return (
    <svg width="44" height="44" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`mtgGrad-${cardId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="100%" stopColor="#b89c66" />
        </linearGradient>
      </defs>
      
      <circle cx="16" cy="16" r="14" stroke="#b89c66" strokeWidth="1.2" strokeDasharray="3 2" />
      <circle cx="16" cy="16" r="11" stroke="#b89c66" strokeWidth="0.8" />
      
      {/* Center stylized PIM in MTG style */}
      <text
        x="16"
        y="16.8"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={`url(#mtgGrad-${cardId})`}
        fontFamily="'Georgia', 'Times New Roman', 'Palatino', serif"
        fontSize="7.5"
        fontWeight="bold"
        letterSpacing="-0.3"
        stroke="#0c0a07"
        strokeWidth="0.8"
        paintOrder="stroke fill"
      >
        PIM
      </text>

      {/* Melody / Rock Note (Top) - Repositioned to sit on outer edge to clear the center PIM */}
      <circle cx="16" cy="4.5" r="2.5" fill="#ff9900" stroke="#b89c66" strokeWidth="0.8" />
      <path d="M15.5 5.5v-2.5h1.5v1" stroke="#000" strokeWidth="0.5" fill="none" />
      
      {/* Vibe Nebula (Bottom Right) - Repositioned to sit on outer edge to clear the center PIM */}
      <circle cx="26" cy="21.8" r="2.5" fill="#00d4aa" stroke="#b89c66" strokeWidth="0.8" />
      <circle cx="26" cy="21.8" r="0.8" fill="#fff" />
      
      {/* Energy Spark (Bottom Left) - Repositioned to sit on outer edge to clear the center PIM */}
      <circle cx="6" cy="21.8" r="2.5" fill="#00bcff" stroke="#b89c66" strokeWidth="0.8" />
      <path d="M6 20.3l-0.8 1.8h1.6l-0.8 1.8" stroke="#fff" strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  );
}

function PokerEmblem({ suit, color }: { suit: string; color: string }) {
  return (
    <svg width="28" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="2" stroke={color} strokeWidth="1" fill="rgba(0,0,0,0.6)" />
      {suit === '♠' ? (
        <path d="M12 5.5c-.2 0-3.2 3.5-3.2 6.5c0 1.8 1.4 3 3.2 3s3.2-1.2 3.2-6.5c0-3-3-6.5-3.2-6.5z M12 14v4.5c0 .3-.1.5-.3.5h-2.2c0-.5.3-1 1-1.5h3c.7.5 1 1 1 1.5h-2.2c-.2 0-.3-.2-.3-.5V14z" fill={color} />
      ) : (
        <path d="M12 17.5l-1.1-1C6.9 12.8 4 10.4 4 7.5C4 5.3 5.7 3.5 7.9 3.5c1.2 0 2.4.6 3.1 1.6c.7-1 1.9-1.6 3.1-1.6c2.2 0 3.9 1.8 3.9 4c0 2.9-2.9 5.3-6.9 9l-1.1 1z" fill={color} />
      )}
    </svg>
  );
}

function DuelistEmblem({ cardId }: { cardId: string }) {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-spin" style={{ animationDuration: '12s' }}>
      <defs>
        <radialGradient id={`portalGlow-${cardId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff7700" stopOpacity="0.8" />
          <stop offset="70%" stopColor="#ff3300" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#portalGlow-${cardId})`} />
      <path d="M32 2a30 30 0 0 1 30 30c0 8.3-3.4 15.8-8.8 21.2L42.4 42.4A15 15 0 0 0 47 32a15 15 0 0 0-15-15V2z" fill="#ff7700" opacity="0.5" />
      <path d="M32 62a30 30 0 0 1-30-30c0-8.3 3.4-15.8 8.8-21.2l10.8 10.8A15 15 0 0 0 17 32a15 15 0 0 0 15 15v15z" fill="#ff3300" opacity="0.5" />
      <circle cx="32" cy="32" r="9" fill="#000000" stroke="#ffaa00" strokeWidth="1.2" />
      <polygon points="32,27 36,34 28,34" fill="#ff7700" />
    </svg>
  );
}

function MonsterRecordBall() {
  return (
    <svg width="52" height="52" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="28" stroke="#ffffff" strokeWidth="2" fill="#222222" />
      <path d="M2 30A28 28 0 0 1 58 30Z" fill="#ff3800" stroke="#ffffff" strokeWidth="2" />
      <circle cx="30" cy="30" r="21" stroke="#ffffff" strokeWidth="1" strokeDasharray="4 4" opacity="0.25" />
      <circle cx="30" cy="30" r="15" stroke="#ffffff" strokeWidth="1" strokeDasharray="2 2" opacity="0.25" />
      <rect x="1" y="27" width="58" height="6" fill="#111111" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="30" cy="30" r="9" fill="#ffffff" stroke="#111111" strokeWidth="1.5" />
      <circle cx="30" cy="30" r="4" fill="#111111" />
    </svg>
  );
}

function BackGlitch({ card }: { card: VaultCard }) {
  return (
    <div className="back-glitch flex flex-col justify-between p-3 select-none">
      <div className="glitch-scanner" />
      <div className="flex justify-between items-center text-[8px] font-mono opacity-60">
        <span>// DECRYPT_KEY //</span>
        <span>SYSTEM_INIT</span>
      </div>
      <div className="flex flex-col items-center justify-center my-auto z-10 gap-2">
        <GlitchIcon color="#00d4aa" accentColor="#ff007f" cardId={card.id} />
        <span className="font-mono text-[8px] text-[#ff007f] tracking-widest">// DECRYPT_CORE //</span>
        <span className="text-[6.5px] text-[#00d4aa] opacity-70 font-mono">LINK_0{card.day}_SYS</span>
      </div>
      <div className="flex justify-between items-center text-[7.5px] font-mono">
        <span className="text-[#ff007f] font-bold">DAY #{String(card.day).padStart(3, '0')}</span>
        <span className="opacity-40">{card.rarity.toUpperCase()}</span>
      </div>
    </div>
  );
}

function BackGlass({ card }: { card: VaultCard }) {
  return (
    <div className="back-glass flex flex-col justify-between p-4 select-none">
      <div className="glass-blob-1" />
      <div className="glass-blob-2" />
      <div className="flex justify-between items-center text-[8px] font-mono text-white/40 z-10">
        <span>TH3_VAULT</span>
        <span>{card.rarity.toUpperCase()}</span>
      </div>
      <div className="z-10 py-4 px-2 rounded bg-white/5 border border-white/10 backdrop-blur-md text-center flex flex-col items-center gap-2 my-auto">
        <GlassIcon cardId={card.id} />
        <span className="text-[7.5px] text-white/50 tracking-[0.2em] font-mono">GEN 0</span>
      </div>
      <div className="flex justify-center z-10">
        <span className="text-[9px] font-mono font-bold text-white/60 tracking-wider">#{String(card.day).padStart(3, '0')}</span>
      </div>
    </div>
  );
}

function BackArcade({ card }: { card: VaultCard }) {
  return (
    <div className="back-arcade flex flex-col justify-between p-3 select-none">
      <div className="arcade-grid" />
      <div className="flex justify-between items-center text-[8px] font-mono text-cyan-400">
        <span>READY PLAYER 1</span>
        <span>INSERT COIN</span>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 py-4 border-y border-cyan-400/30 my-auto bg-black/60 z-10">
        <ArcadeIcon />
        <span className="text-[7.5px] text-cyan-400 font-mono tracking-widest">ARCADE EDITION</span>
      </div>
      <div className="flex justify-between items-center text-[8px] font-mono text-pink-500">
        <span>DAY {card.day}</span>
        <span>GEN-80S</span>
      </div>
    </div>
  );
}

function BackMtg({ card }: { card: VaultCard }) {
  return (
    <div className="back-mtg p-3 select-none flex flex-col justify-between items-center">
      <div className="mtg-oval-back flex flex-col items-center justify-center gap-2.5 my-auto">
        <span className="font-mono text-[9px] text-[#b89c66] tracking-[0.2em] uppercase font-bold">th3v4ult</span>
        <MtgSigil cardId={card.id} />
        <span className="font-serif text-[7.5px] text-[#ffd700] italic">Gen 0 Edition</span>
      </div>
      <span className="text-[8px] font-mono text-[#b89c66]/80 self-end">DAY #{String(card.day).padStart(3, '0')}</span>
    </div>
  );
}

function BackPoker({ card }: { card: VaultCard }) {
  const isLight = card.mood === 'light';
  const suit = isLight ? '♥' : '♠';
  return (
    <div className="back-poker p-2 select-none flex flex-col justify-between items-center">
      <div className="poker-scroll-pattern" />
      <div className="w-full flex justify-between text-[10px] text-white/85 font-serif">
        <span>{suit}</span>
        <span>{suit}</span>
      </div>
      <div className="w-14 h-20 border border-white/20 rounded flex flex-col items-center justify-center gap-2 bg-red-950/70 z-10 shadow-md my-auto">
        <PokerEmblem suit={suit} color="#fbbf24" />
        <span className="font-mono text-[7px] text-amber-200 tracking-wider">DAY {card.day}</span>
      </div>
      <div className="w-full flex justify-between text-[10px] text-white/85 font-serif transform rotate-180">
        <span>{suit}</span>
        <span>{suit}</span>
      </div>
    </div>
  );
}

function BackDuelist({ card }: { card: VaultCard }) {
  return (
    <div className="back-duelist p-3 select-none flex flex-col justify-between items-center">
      <div className="duelist-swirl" />
      <span className="text-[7.5px] font-mono text-orange-500/80 tracking-widest uppercase">DUEL BEAT</span>
      <div className="duelist-circle flex items-center justify-center my-auto z-10">
        <DuelistEmblem cardId={card.id} />
      </div>
      <div className="w-full flex justify-between text-[6.5px] font-mono text-orange-400/60 uppercase">
        <span>Vault Card</span>
        <span>Day {card.day}</span>
      </div>
    </div>
  );
}

function BackMonster({ card }: { card: VaultCard }) {
  return (
    <div className="back-monster p-2.5 select-none">
      <div className="monster-inner-card flex flex-col justify-between p-2">
        <div className="flex justify-between items-center text-[7.5px] text-amber-400 font-bold tracking-wider">
          <span>POCKET BEATS</span>
          <span>TCG</span>
        </div>
        <div className="monster-center-ball self-center my-auto z-10">
          <MonsterRecordBall />
        </div>
        <div className="flex justify-between items-center text-[7px] text-white/40">
          <span>VAULT CARD</span>
          <span>DAY #{card.day}</span>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// DESIGN 0: ORIGINAL PRODUCTION LAYOUT (theme-original)
// --------------------------------------------------------------------------
function CardOriginal({ card, backSide }: { card: VaultCard; backSide?: React.ReactNode }) {
  const activeColor = RARITY_COLORS[card.rarity];
  const maxSupply = getRarityMaxSupply(card.rarity);
  const mintPct = Math.min((card.claimedCount / maxSupply) * 100, 100);
  const finalBack = backSide || <StandardVaultCardBack card={card} />;

  const StatBox = ({ label, value }: { label: string; value: string | number }) => (
    <div className="flex flex-col items-center p-1 bg-black/35 border border-white/5 rounded">
      <span className="font-mono text-[7px] text-white/35 uppercase tracking-wider">{label}</span>
      <span className="font-mono text-[9px] font-bold leading-tight" style={{ color: activeColor }}>{value}</span>
    </div>
  );

  const mintBar = (
    <div className="h-[2px] w-full bg-white/10 rounded overflow-hidden">
      <div 
        className="h-full rounded" 
        style={{ 
          width: `${mintPct}%`, 
          background: activeColor,
          boxShadow: `0 0 6px ${activeColor}`
        }} 
      />
    </div>
  );

  // Common original front
  const commonFront = (
    <div className="flex flex-col h-full bg-[#0c0a07] border border-white/10 select-none overflow-hidden rounded-xl">
      <div className="px-3 py-1.5 border-b border-white/10 flex justify-between items-center bg-white/5">
        <span className="font-mono text-[8px] font-bold text-white/60">#{String(card.day).padStart(3, '0')}</span>
        <span className="font-mono text-[8px] font-extrabold uppercase text-white/40">★ COMMON</span>
      </div>
      <div className="relative h-[44%] overflow-hidden border-b border-white/10">
        <img src={card.coverUrl} alt={card.title} className="w-full h-full object-cover" />
      </div>
      <div className="p-2 flex flex-col gap-2 flex-grow justify-between">
        <div>
          <h3 className="font-sans font-black text-sm uppercase text-[#faf0d8] truncate mb-1">{card.title}</h3>
          <div className="grid grid-cols-4 gap-1">
            <StatBox label="NRG" value={`${Math.round(card.energy * 100)}%`} />
            <StatBox label="VAL" value={`${Math.round(card.valence * 100)}%`} />
            <StatBox label="BPM" value={card.tempo} />
            <StatBox label="MOD" value={card.mood === 'light' ? '☀' : '🌙'} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {mintBar}
          <span className="font-mono text-[7px] text-white/20 uppercase">{card.claimedCount} PULLED</span>
        </div>
      </div>
    </div>
  );

  // Uncommon original front
  const uncommonFront = (
    <div className="flex flex-col h-full bg-[#0c0a07] border border-[#4ade80]/40 select-none overflow-hidden rounded-xl relative">
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
      <div className="relative h-[58%] overflow-hidden border-b border-[#4ade80]/20">
        <img src={card.coverUrl} alt={card.title} className="w-full h-full object-cover" />
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 border border-[#4ade80]/40 rounded font-mono text-[8px] font-bold text-white">
          #{String(card.day).padStart(3, '0')}
        </div>
      </div>
      <div className="p-2.5 flex flex-col gap-2 flex-grow justify-between">
        <div>
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-sans font-black text-xs uppercase text-[#faf0d8] truncate flex-1">{card.title}</h3>
            <span className="font-mono text-[7px] font-bold text-[#4ade80] uppercase tracking-wider ml-1 bg-[#4ade80]/10 border border-[#4ade80]/30 px-1 rounded">UNCOMMON</span>
          </div>
          <div className="flex gap-2 text-[8px] font-mono text-[#4ade80]">
            <span>{Math.round(card.energy * 100)}% NRG</span>
            <span className="opacity-30">•</span>
            <span>{card.tempo} BPM</span>
            <span className="opacity-30">•</span>
            <span className="text-white/40">{card.mood === 'light' ? '☀ Light' : '🌙 Dark'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[7px] text-white/20 whitespace-nowrap">{card.claimedCount} PULLED</span>
          {mintBar}
        </div>
      </div>
    </div>
  );

  // Rare original front
  const rareFront = (
    <div className="relative h-full w-full select-none overflow-hidden rounded-xl border border-[#3b82f6]/40">
      <img src={card.coverUrl} alt={card.title} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 border border-[#3b82f6]/40 rounded font-mono text-[8px] font-bold text-white">
        #{String(card.day).padStart(3, '0')}
      </div>
      <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#3b82f6]/20 border border-[#3b82f6]/60 rounded font-mono text-[7px] font-bold text-[#3b82f6] uppercase tracking-wider">
        ★ RARE
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/60 backdrop-blur border-t border-white/10">
        <h3 className="font-sans font-black text-sm uppercase text-[#faf0d8] truncate mb-1">{card.title}</h3>
        <div className="flex justify-between items-center text-[8px] font-mono text-white/40 mb-1.5">
          <span>{card.claimedCount} PULLED</span>
          <span className="text-[#3b82f6]">{card.tempo} BPM</span>
        </div>
        {mintBar}
      </div>
    </div>
  );

  // Legendary original front
  const legendaryFront = (
    <div className="relative h-full w-full select-none overflow-hidden rounded-xl border-2 border-[#b44dff]/60">
      <img src={card.coverUrl} alt={card.title} className="absolute inset-0 w-full h-full object-cover rotate-zoom-art" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/60" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-[#b44dff]/20 to-transparent bg-[length:300%_100%] animate-[foil-sweep_4s_linear_infinite]" />
      
      <div className="absolute top-2 left-2 px-2 py-0.5 bg-[#b44dff]/20 border border-[#b44dff]/60 rounded font-mono text-[7px] font-bold text-[#b44dff] uppercase tracking-widest">
        ★ LEGENDARY
      </div>
      <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 border border-white/10 rounded font-mono text-[8px] font-bold text-white">
        #{String(card.day).padStart(3, '0')}
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col gap-1.5">
        <h3 className="font-sans font-black text-base uppercase text-[#faf0d8] truncate text-stroke-outline">{card.title}</h3>
        <div className="flex gap-2 text-[8px] font-mono text-white/50">
          <span className="text-[#b44dff] font-bold">DAY {card.day}</span>
          <span>•</span>
          <span>{card.claimedCount} PULLED</span>
        </div>
        {mintBar}
      </div>
    </div>
  );

  // Mythic original front
  const mythicFront = (
    <div className="relative h-full w-full select-none overflow-hidden rounded-xl border-2 border-[#ffd700]">
      <img src={card.coverUrl} alt={card.title} className="absolute inset-0 w-full h-full object-cover rotate-zoom-mythic" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/60" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#ffd700]/10 via-[#ff007f]/15 to-[#00f0ff]/10 bg-[length:300%_100%] animate-[foil-sweep_3s_linear_infinite]" />
      
      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 border border-[#ffd700]/60 rounded font-mono text-[8px] font-bold text-white">
        #{String(card.day).padStart(3, '0')}
      </div>
      <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#ffd700]/20 border border-[#ffd700] rounded font-mono text-[7px] font-black text-[#ffd700] uppercase tracking-widest shadow-[0_0_8px_rgba(255,215,0,0.4)]">
        ✦ MYTHIC
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col gap-1.5">
        <h3 className="font-sans font-black text-base uppercase text-white tracking-wide text-stroke-outline" style={{ textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>{card.title}</h3>
        <div className="flex gap-2 text-[8px] font-mono text-white/50">
          <span className="text-[#ffd700] font-bold">DAY {card.day}</span>
          <span>•</span>
          <span>1 OF 1</span>
        </div>
        {mintBar}
      </div>
    </div>
  );

  const frontFace =
    card.rarity === 'common' ? commonFront :
    card.rarity === 'uncommon' ? uncommonFront :
    card.rarity === 'rare' ? rareFront :
    card.rarity === 'legendary' ? legendaryFront :
    mythicFront;

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="original" backSide={finalBack}>
      {frontFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 1: NEON-BRUTALIST GLITCH (High Contrast Cyberpunk)
// --------------------------------------------------------------------------
function CardGlitch({ card, backSide }: { card: VaultCard; backSide?: React.ReactNode }) {
  const rarityColors: Record<Rarity, string> = {
    common: '#ffffff',
    uncommon: '#00d4aa',
    rare: '#00bcff',
    legendary: '#ff007f',
    mythic: '#ffd700',
  };

  const activeColor = rarityColors[card.rarity];
  const isFullBleed = card.rarity === 'legendary' || card.rarity === 'mythic';
  const isRotatedZoom = card.rarity === 'legendary' || card.rarity === 'mythic';
  
  const heightClass = 
    card.rarity === 'common' ? 'h-common' :
    card.rarity === 'uncommon' ? 'h-uncommon' :
    card.rarity === 'rare' ? 'h-rare' :
    card.rarity === 'legendary' ? 'h-legendary' : 'h-mythic';

  const metadataInfo = (
    <div className="flex flex-col flex-grow z-10 pt-1">
      <h3 className="brutalist-title text-sm font-black tracking-tight leading-none truncate mb-1">
        {card.title}
      </h3>

      {/* Tags */}
      <div className="flex gap-1 mb-1.5 overflow-hidden whitespace-nowrap">
        {card.tags.map(tag => (
          <span key={tag} className="text-[8px] px-1 bg-white/10 text-white/70 border border-white/20 uppercase">
            {tag}
          </span>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mb-1.5">
        <div className="flex justify-between text-[8px] border-b border-white/20 pb-0.5">
          <span className="opacity-50">NRG:</span>
          <span style={{ color: activeColor }}>{Math.round(card.energy * 100)}%</span>
        </div>
        <div className="flex justify-between text-[8px] border-b border-white/20 pb-0.5">
          <span className="opacity-50">VAL:</span>
          <span style={{ color: activeColor }}>{Math.round(card.valence * 100)}%</span>
        </div>
        <div className="flex justify-between text-[8px] border-b border-white/20 pb-0.5">
          <span className="opacity-50">BPM:</span>
          <span style={{ color: activeColor }}>{card.tempo}</span>
        </div>
        <div className="flex justify-between text-[8px] border-b border-white/20 pb-0.5">
          <span className="opacity-50">MOD:</span>
          <span>{card.mood === 'light' ? 'LGT' : 'DRK'}</span>
        </div>
      </div>

      {/* Supply progress */}
      <div className="mt-auto">
        <div className="flex justify-between text-[7px] opacity-40 mb-0.5">
          <span>SUPPLY CAP</span>
          <span>{card.claimedCount} / {getRarityMaxSupply(card.rarity)}</span>
        </div>
        <div className="h-1 w-full bg-white/10 border border-black overflow-hidden">
          <div 
            className="h-full" 
            style={{ 
              width: `${(card.claimedCount / getRarityMaxSupply(card.rarity)) * 100}%`,
              background: activeColor 
            }} 
          />
        </div>
      </div>
    </div>
  );

  const frontFace = (
    <div className="flex flex-col h-full relative overflow-hidden select-none">
      {/* Background patterns */}
      {card.rarity === 'mythic' && <div className="mythic-foil-wash" />}
      {card.rarity === 'rare' && <div className="terminal-scanline" />}

      {/* Top Header Row */}
      <div className="flex justify-between items-center mb-1 z-20 p-2 pb-0">
        <span className={`font-mono text-[9px] ${isFullBleed ? 'text-stroke-outline' : ''}`} style={{ color: activeColor }}>
          SYS.LOC // #{String(card.day).padStart(3, '0')}
        </span>
        <span className="brutalist-badge">{card.rarity}</span>
      </div>

      {/* Album Art Cover (Graduating in size & orientation) */}
      <div className={`card-image-box ${heightClass} ${isFullBleed ? 'absolute inset-0 z-0' : 'border-2 border-black m-2'}`}>
        <img 
          src={card.coverUrl} 
          alt={card.title} 
          className={`w-full h-full object-cover ${card.rarity === 'mythic' ? 'rotate-zoom-mythic' : card.rarity === 'legendary' ? 'rotate-zoom-art' : ''}`} 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
        
        {/* Play indicator */}
        <div className="absolute bottom-2 right-2 p-1 bg-black border border-white/40 rounded z-10">
          <Play size={10} style={{ color: activeColor }} />
        </div>
      </div>

      {/* Info Box - either overlay drawer or static below */}
      {isFullBleed ? (
        <div className="floating-overlay-info">
          {card.rarity === 'legendary' && <div className="hazard-strip mb-2" />}
          {metadataInfo}
          {card.rarity === 'mythic' && (
            <div className="scrolling-metadata-wrapper">
              <div className="scrolling-metadata-text">
                INITIALIZED // DIGITAL_GRAIL // ID: {card.id.toUpperCase()} // STATUS: AUTHENTICATED
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-2 pt-0 flex flex-col flex-1">
          {metadataInfo}
        </div>
      )}
    </div>
  );

  const finalBack = backSide || <StandardVaultCardBack card={card} />;

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="glitch" backSide={finalBack}>
      {frontFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 2: GLASS-OUTRUN MINIMALIST (Premium Sleek Glassmorphism)
// --------------------------------------------------------------------------
function CardGlass({ card, backSide }: { card: VaultCard; backSide?: React.ReactNode }) {
  const rarityGlows: Record<Rarity, string> = {
    common: 'rgba(255,255,255,0.15)',
    uncommon: 'rgba(0, 212, 170, 0.35)',
    rare: 'rgba(59, 130, 246, 0.45)',
    legendary: 'rgba(180, 77, 255, 0.55)',
    mythic: 'rgba(255, 215, 0, 0.65)',
  };

  const isFullBleed = card.rarity === 'legendary' || card.rarity === 'mythic';
  const isRotatedZoom = card.rarity === 'legendary' || card.rarity === 'mythic';
  
  const heightClass = 
    card.rarity === 'common' ? 'h-common' :
    card.rarity === 'uncommon' ? 'h-uncommon' :
    card.rarity === 'rare' ? 'h-rare' :
    card.rarity === 'legendary' ? 'h-legendary' : 'h-mythic';

  const metadataInfo = (
    <div className="flex flex-col flex-grow z-10 pt-1">
      <h3 className="text-sm font-bold leading-tight tracking-tight mb-1 truncate text-white">
        {card.title}
      </h3>

      <div className="glass-divider my-1" />

      {/* Stats List */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className="glass-stat-pill">⚡ NRG {Math.round(card.energy * 100)}</span>
        <span className="glass-stat-pill">🧬 VAL {Math.round(card.valence * 100)}</span>
        <span className="glass-stat-pill">💿 {card.tempo} BPM</span>
      </div>

      {/* Mint bar */}
      <div className="mt-auto pt-1">
        <div className="flex justify-between text-[7px] text-white/30 mb-0.5">
          <span>RELEASE MINT INDEX</span>
          <span>{card.claimedCount} / {getRarityMaxSupply(card.rarity)}</span>
        </div>
        <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full" 
            style={{ 
              width: `${(card.claimedCount / getRarityMaxSupply(card.rarity)) * 100}%`,
              background: rarityGlows[card.rarity] 
            }} 
          />
        </div>
      </div>
    </div>
  );

  const frontFace = (
    <div className="flex flex-col h-full relative overflow-hidden select-none">
      {/* Backdrop patterns */}
      {card.rarity === 'mythic' && (
        <>
          <div className="glass-sweeping-border" />
          <div className="neon-glow-backdrop" />
        </>
      )}
      {card.rarity === 'legendary' && (
        <>
          <div className="glass-mesh" />
          <div className="gold-accent-border" />
        </>
      )}

      {/* Top Header Row */}
      <div className="flex justify-between items-center mb-1.5 z-20 p-2 pb-0">
        <div className="flex flex-col">
          <span className={`text-[7px] text-white/40 tracking-wider font-sans ${isFullBleed ? 'text-stroke-outline' : ''}`}>ENTRY</span>
          <span className={`text-[9px] font-bold font-sans ${isFullBleed ? 'text-stroke-outline' : ''}`}>#00{card.day}</span>
        </div>
        <span className="text-[7px] px-2 py-0.5 rounded-full border bg-black/40 text-white/80" style={{ borderColor: rarityGlows[card.rarity] }}>
          {card.rarity.toUpperCase()}
        </span>
      </div>

      {/* Album Art Cover (Graduating in size) */}
      <div className={`card-image-box ${heightClass} ${isFullBleed ? 'absolute inset-0 z-0' : 'rounded-lg border border-white/10 m-1'}`}>
        <img 
          src={card.coverUrl} 
          alt={card.title} 
          className={`w-full h-full object-cover ${card.rarity === 'mythic' ? 'rotate-zoom-mythic' : card.rarity === 'legendary' ? 'rotate-zoom-art' : 'scale-105'}`} 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
        
        {/* Subtle hover bloom */}
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse" style={{ background: rarityGlows[card.rarity] }} />
      </div>

      {/* Info drawer - overlays on full art or sits statically below */}
      {isFullBleed ? (
        <div className="floating-overlay-info">
          {metadataInfo}
        </div>
      ) : (
        <div className="p-2 pt-0 flex flex-col flex-1">
          {metadataInfo}
        </div>
      )}
    </div>
  );

  const finalBack = backSide || <StandardVaultCardBack card={card} />;

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="glass" backSide={finalBack}>
      {frontFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 3: RETRO-ARCADE 80s (Vintage Synthesizer Deck)
// --------------------------------------------------------------------------
function CardArcade({ card, backSide }: { card: VaultCard; backSide?: React.ReactNode }) {
  const stripeColors: Record<Rarity, string[]> = {
    common: ['#ff3800', '#ffffff'],
    uncommon: ['#ffcc00', '#000000'],
    rare: ['#ff0055', '#00f0ff'],
    legendary: ['#ff007f', '#ffcc00'],
    mythic: ['#ffd700', '#000000'],
  };

  const outlineColor = stripeColors[card.rarity][0];
  const isFullBleed = card.rarity === 'legendary' || card.rarity === 'mythic';
  const isRotatedZoom = card.rarity === 'legendary' || card.rarity === 'mythic';
  
  const heightClass = 
    card.rarity === 'common' ? 'h-common' :
    card.rarity === 'uncommon' ? 'h-uncommon' :
    card.rarity === 'rare' ? 'h-rare' :
    card.rarity === 'legendary' ? 'h-legendary' : 'h-mythic';

  const metadataInfo = (
    <div className="flex flex-col flex-grow z-10 pt-1 font-mono">
      <h3 className="text-xs font-black uppercase text-white tracking-wide truncate mb-1 text-shadow-retro">
        {card.title}
      </h3>

      {/* Synthesizer Knobs */}
      {card.rarity === 'uncommon' && (
        <div className="knobs-container mb-1.5">
          <div className="flex items-center gap-1">
            <div className="retro-knob" />
            <span className="text-[7px] text-white/50">EQ-A</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="retro-knob" />
            <span className="text-[7px] text-white/50">EQ-B</span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="bg-black/60 p-1 border border-white/10 rounded mb-1.5 text-[8px]">
        <div className="flex justify-between mb-0.5">
          <span className="text-slate-400">ENERGY:</span>
          <span className="text-amber-400">{Math.round(card.energy * 100)}</span>
        </div>
        <div className="flex justify-between mb-0.5">
          <span className="text-slate-400">VALENCE:</span>
          <span className="text-amber-400">{Math.round(card.valence * 100)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">TEMPO:</span>
          <span className="text-cyan-400">{card.tempo} BPM</span>
        </div>
      </div>

      {/* Synth Step buttons */}
      <div className="mt-auto">
        <div className="flex justify-between text-[7px] opacity-40 mb-1">
          <span>UNITS CLAIMED</span>
          <span>{card.claimedCount} / {getRarityMaxSupply(card.rarity)}</span>
        </div>
        {/* LED Bar */}
        <div className="flex gap-0.5 h-1.5">
          {Array.from({ length: 8 }).map((_, idx) => {
            const active = idx < Math.round((card.claimedCount / getRarityMaxSupply(card.rarity)) * 8);
            return (
              <div 
                key={idx} 
                className="flex-1 rounded-sm" 
                style={{ 
                  background: active ? outlineColor : '#222',
                  boxShadow: active ? `0 0 4px ${outlineColor}` : 'none'
                }} 
              />
            );
          })}
        </div>
      </div>
    </div>
  );

  const frontFace = (
    <div className="flex flex-col h-full relative overflow-hidden select-none">
      {/* Background vector graphics */}
      {card.rarity === 'mythic' && (
        <>
          <div className="grid-vector-scroll" />
          <div className="iridescent-sheen" />
          <div className="laser-star">★</div>
        </>
      )}
      {card.rarity === 'legendary' && (
        <>
          <div className="wireframe-sun" />
          <div className="wireframe-grid" />
        </>
      )}
      {card.rarity === 'uncommon' && <div className="arcade-yellow-grid" />}

      {/* Vintage Stripes */}
      {card.rarity === 'common' && (
        <div className="retro-stripe-bar z-20">
          <div className="retro-stripe-red" />
          <div className="retro-stripe-white" />
        </div>
      )}
      {card.rarity === 'rare' && <div className="diagonal-stripes mb-1 z-20" />}

      {/* Header Row */}
      <div className="flex justify-between items-center mb-1 z-20 p-1">
        <span className={`text-[9px] font-bold text-amber-500 uppercase tracking-tighter ${isFullBleed ? 'text-stroke-outline' : ''}`}>
          DECK: {String(card.day).padStart(3, '0')}
        </span>
        {card.rarity === 'rare' ? (
          <span className="pixel-badge">RARE STEP</span>
        ) : (
          <span className="text-[7px] bg-black px-1.5 py-0.5 border border-white/20 rounded text-slate-300">
            {card.rarity.toUpperCase()}
          </span>
        )}
      </div>

      {/* Album Art Cover (Graduating in size) */}
      <div className={`card-image-box ${heightClass} ${isFullBleed ? 'absolute inset-0 z-0' : 'border-4 border-slate-800 m-1 z-10'}`}>
        <img 
          src={card.coverUrl} 
          alt={card.title} 
          className={`w-full h-full object-cover ${card.rarity === 'mythic' ? 'rotate-zoom-mythic' : card.rarity === 'legendary' ? 'rotate-zoom-art' : 'filter contrast-125 saturate-150'}`} 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent" />
      </div>

      {/* Overlay or static info block */}
      {isFullBleed ? (
        <div className="floating-overlay-info">
          {metadataInfo}
        </div>
      ) : (
        <div className="p-1.5 pt-0 flex flex-col flex-1 z-10">
          {metadataInfo}
        </div>
      )}
    </div>
  );

  const finalBack = backSide || <StandardVaultCardBack card={card} />;

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="arcade" backSide={finalBack}>
      {frontFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 4: MAGIC: THE GATHERING (MTG Glass-Outrun Hybrid Edition)
// --------------------------------------------------------------------------
function CardMtg({ card, backSide }: { card: VaultCard; backSide?: React.ReactNode }) {
  const isFullBleed = card.rarity === 'legendary' || card.rarity === 'mythic';
  const isRotatedZoom = card.rarity === 'legendary' || card.rarity === 'mythic';
  
  const heightClass = 
    card.rarity === 'common' ? 'h-common' :
    card.rarity === 'uncommon' ? 'h-uncommon' :
    card.rarity === 'rare' ? 'h-rare' :
    card.rarity === 'legendary' ? 'h-legendary' : 'h-mythic';

  // Traditional Framed MTG Layout (Common, Uncommon, Rare)
  const traditionalFace = (
    <div className="mtg-glass-frame">
      {/* Title block */}
      <div className="mtg-title-bar">
        <span className="mtg-title-text truncate max-w-[130px]">{card.title}</span>
        <div className="mtg-mana-cost">
          <div className="mtg-mana-bubble mtg-mana-nrg" title="Energy">{Math.round(card.energy * 10)}</div>
          <div className="mtg-mana-bubble mtg-mana-val" title="Valence">{Math.round(card.valence * 10)}</div>
          <div className="mtg-mana-bubble mtg-mana-bpm" title="BPM">{Math.round(card.tempo / 10)}</div>
        </div>
      </div>

      {/* Artwork Screen */}
      <div className={`mtg-art-frame ${heightClass}`}>
        <img src={card.coverUrl} alt={card.title} className="w-full h-full object-cover" />
        {card.rarity === 'rare' && <div className="mtg-holo-seal" />}
      </div>

      {/* Type line bar */}
      <div className="mtg-type-bar truncate text-[8px] font-sans">
        Song — {card.genre[0] || 'Unknown'} {card.genre[1] ? `/ ${card.genre[1]}` : ''}
      </div>

      {/* Text Box / Ability Card details */}
      <div className="mtg-text-box font-sans">
        <div className="text-[7.5px] leading-snug">
          <p className="m-0 font-bold opacity-60 uppercase text-[6.5px] mb-0.5">// Day {card.day} Codex Entry:</p>
          <p className="m-0 leading-normal">{card.description}</p>
        </div>
        {card.rarity !== 'rare' && (
          <div className="mtg-flavor-text">
            "{card.tags.map(t => `#${t}`).join(' ')} · {card.mood.toUpperCase()} TIME"
          </div>
        )}
        <div className="mtg-pt-box">
          {Math.round(card.energy * 100)} / {Math.round(card.valence * 100)}
        </div>
      </div>
    </div>
  );

  // Borderless Full-art MTG Layout (Legendary, Mythic) with Glassmorphism Overlays
  const borderlessFace = (
    <div className="relative h-full w-full">
      {/* Background cover image 100% size (rotated and zoomed ONLY on legendary/mythic) */}
      <img 
        src={card.coverUrl} 
        alt={card.title} 
        className={`absolute inset-0 w-full h-full object-cover z-0 ${card.rarity === 'mythic' ? 'rotate-zoom-mythic' : 'rotate-zoom-art'}`} 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent z-5" />

      {/* Iridescent active gradient sweeps on legendary/mythic front face */}
      {card.rarity === 'mythic' && <div className="mythic-foil-wash" />}
      {card.rarity === 'legendary' && <div className="mythic-foil-wash" style={{ opacity: 0.5 }} />}

      {/* Frame overlay wrapper */}
      <div className="mtg-borderless-frame">
        {/* Floating glass title bar */}
        <div className="mtg-floating-title">
          <span className="mtg-title-text truncate max-w-[130px]">{card.title}</span>
          <div className="mtg-mana-cost">
            <div className="mtg-mana-bubble mtg-mana-nrg">{Math.round(card.energy * 10)}</div>
            <div className="mtg-mana-bubble mtg-mana-val">{Math.round(card.valence * 10)}</div>
            <div className="mtg-mana-bubble mtg-mana-bpm">{Math.round(card.tempo / 10)}</div>
          </div>
        </div>

        {/* Floating glass rules text block */}
        <div className="mtg-floating-textbox font-sans">
          {card.rarity === 'mythic' && <div className="mtg-iridescent-overlay" />}
          
          <div className="text-[7.5px] relative z-10">
            <span className="font-bold text-amber-300 block border-b border-white/10 pb-0.5 mb-1 uppercase text-[6.5px] tracking-wide">
              {card.rarity === 'legendary' ? 'Legendary' : 'Mythic'} Song — {card.genre.join(' / ')}
            </span>
            <p className="m-0 leading-normal opacity-90">
              "{card.description}"
            </p>
          </div>

          <div className="flex justify-between items-center mt-2 relative z-10 border-t border-white/10 pt-1">
            <span className="text-[7px] text-white/50 uppercase tracking-widest">
              DAY {card.day} · GEN 0
            </span>
            <div className="mtg-pt-box bg-black border-amber-400 text-amber-400 m-0">
              {Math.round(card.energy * 100)} / {Math.round(card.valence * 100)}
            </div>
          </div>

          {/* Holo stamps */}
          {card.rarity === 'mythic' && (
            <div className="mtg-holo-seal-gold" title="Mythic Rare">
              <span className="text-[7px] text-black">★</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const finalBack = backSide || <StandardVaultCardBack card={card} />;

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="mtg" backSide={finalBack}>
      {isFullBleed ? borderlessFace : traditionalFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 5: CLASSIC TAROT / POKER PLAYING CARD (theme-poker)
// --------------------------------------------------------------------------
function CardPoker({ card, backSide }: { card: VaultCard; backSide?: React.ReactNode }) {
  const isFullBleed = card.rarity === 'legendary' || card.rarity === 'mythic';
  
  // Choose suit: Hearts/Diamonds for light mood, Spades/Clubs for dark mood
  const isLight = card.mood === 'light';
  const suit = isLight ? (card.day % 2 === 0 ? '♥' : '♦') : (card.day % 2 === 0 ? '♠' : '♣');
  const isRed = isLight;
  const rank = card.day.toString();

  const heightClass = 
    card.rarity === 'common' ? 'h-common' :
    card.rarity === 'uncommon' ? 'h-uncommon' :
    card.rarity === 'rare' ? 'h-rare' :
    card.rarity === 'legendary' ? 'h-legendary' : 'h-mythic';

  const finalBack = backSide || <StandardVaultCardBack card={card} />;

  // Common/Uncommon/Rare Traditional Face
  const traditionalFace = (
    <>
      {/* Corner Rank & Suit */}
      <div className="poker-index poker-index-tl">
        <span>{rank}</span>
        <span className={isRed ? 'poker-suit-red' : ''}>{suit}</span>
      </div>
      <div className="poker-index poker-index-br">
        <span>{rank}</span>
        <span className={isRed ? 'poker-suit-red' : ''}>{suit}</span>
      </div>

      {/* Art Oval Frame */}
      <div className={`poker-art-frame ${heightClass}`}>
        <img src={card.coverUrl} alt={card.title} className="w-full h-full object-cover" />
      </div>

      <div className="poker-divider-line" />

      {/* Title Scroll Banner */}
      <div className="poker-title-banner truncate">
        {card.title}
      </div>
    </>
  );

  // Borderless Full-Art Tarot Face (Legendary, Mythic)
  const borderlessFace = (
    <div className="relative h-full w-full">
      {/* Cover Image */}
      <img 
        src={card.coverUrl} 
        alt={card.title} 
        className={`absolute inset-0 w-full h-full object-cover z-0 ${card.rarity === 'mythic' ? 'rotate-zoom-mythic' : 'rotate-zoom-art'}`} 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/70 z-5" />

      {card.rarity === 'mythic' && <div className="mythic-foil-wash" />}

      {/* Floating filigree gold frame */}
      <div className="absolute inset-2 border-2 border-[#ffd700]/60 rounded-lg pointer-events-none z-10">
        <div className="absolute inset-1.5 border border-[#ffd700]/30 rounded" />
      </div>

      {/* Corner Indices overlay */}
      <div className="poker-index poker-index-tl z-20 text-[#ffd700] text-stroke-outline">
        <span>{rank}</span>
        <span className={isRed ? 'poker-suit-red' : ''}>{suit}</span>
      </div>
      <div className="poker-index poker-index-br z-20 text-[#ffd700] text-stroke-outline">
        <span>{rank}</span>
        <span className={isRed ? 'poker-suit-red' : ''}>{suit}</span>
      </div>

      {/* Title overlay in central scroll */}
      <div className="absolute bottom-4 left-4 right-4 z-20">
        <div className="poker-title-banner border-[#ffd700] text-[#ffd700] bg-black/90 m-0">
          {card.title}
        </div>
      </div>
    </div>
  );

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="poker" backSide={finalBack}>
      {isFullBleed ? borderlessFace : traditionalFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 6: DUELIST MONSTER CARD (theme-duelist)
// --------------------------------------------------------------------------
function CardDuelist({ card, backSide }: { card: VaultCard; backSide?: React.ReactNode }) {
  const isFullBleed = card.rarity === 'legendary' || card.rarity === 'mythic';
  
  // Kanji Attribute
  const isLight = card.mood === 'light';
  const attrText = isLight ? '光' : '暗';
  const attrColor = isLight ? '#f59e0b' : '#312e81';

  // Stars count
  const starCount = 
    card.rarity === 'common' ? 3 :
    card.rarity === 'uncommon' ? 4 :
    card.rarity === 'rare' ? 6 :
    card.rarity === 'legendary' ? 8 : 10;

  const heightClass = 
    card.rarity === 'common' ? 'h-common' :
    card.rarity === 'uncommon' ? 'h-uncommon' :
    card.rarity === 'rare' ? 'h-rare' :
    card.rarity === 'legendary' ? 'h-legendary' : 'h-mythic';

  const finalBack = backSide || <StandardVaultCardBack card={card} />;

  // ATK / DEF stats
  const atk = Math.round(card.energy * 3000) + 500;
  const def = Math.round(card.valence * 3000) + 500;

  const traditionalFace = (
    <>
      {/* Header */}
      <div className="duelist-header">
        <span className="duelist-title truncate max-w-[130px]">{card.title}</span>
        <div className="duelist-attr" style={{ background: attrColor }}>
          {attrText}
        </div>
      </div>

      {/* Stars */}
      <div className="duelist-stars">
        {Array.from({ length: starCount }).map((_, i) => (
          <div key={i} className="duelist-star-icon" />
        ))}
      </div>

      {/* Art Screen */}
      <div className={`duelist-art-frame ${heightClass}`}>
        <img src={card.coverUrl} alt={card.title} className="w-full h-full object-cover" />
      </div>

      {/* Text Box */}
      <div className="duelist-textbox">
        <div className="duelist-effect">
          <span className="font-bold">// DAY-{card.day} //</span> {card.description}
        </div>
        <div className="duelist-stats-line">
          <span>ATK/ <span className="duelist-stat-value">{atk}</span></span>
          <span>DEF/ <span className="duelist-stat-value">{def}</span></span>
        </div>
      </div>
    </>
  );

  const borderlessFace = (
    <div className="relative h-full w-full">
      <img 
        src={card.coverUrl} 
        alt={card.title} 
        className={`absolute inset-0 w-full h-full object-cover z-0 ${card.rarity === 'mythic' ? 'rotate-zoom-mythic' : 'rotate-zoom-art'}`} 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent z-5" />

      {card.rarity === 'mythic' && <div className="mythic-foil-wash" />}
      
      {/* Full Bleed Card UI overlays */}
      <div className="absolute inset-0 z-10 flex flex-col justify-between p-1.5">
        <div>
          {/* Header */}
          <div className="duelist-header bg-black/80 border-[#ffd700]/40">
            <span className="duelist-title text-[#ffd700] truncate max-w-[130px]">{card.title}</span>
            <div className="duelist-attr" style={{ background: attrColor, borderColor: '#ffd700' }}>
              {attrText}
            </div>
          </div>

          {/* Stars */}
          <div className="duelist-stars">
            {Array.from({ length: starCount }).map((_, i) => (
              <div key={i} className="duelist-star-icon" style={{ boxShadow: '0 0 4px #ffb800' }} />
            ))}
          </div>
        </div>

        {/* Text Box Overlay */}
        <div className="duelist-textbox border-[#ffd700]/60 bg-black/90 text-white">
          <div className="duelist-effect">
            <span className="font-bold text-[#ffd700] uppercase text-[6px] block mb-0.5">Legendary Monster — Synth</span>
            "{card.description}"
          </div>
          <div className="duelist-stats-line border-t-white/10">
            <span>ATK/ <span className="duelist-stat-value text-[#ffd700]">{atk}</span></span>
            <span>DEF/ <span className="duelist-stat-value text-[#ffd700]">{def}</span></span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="duelist" backSide={finalBack}>
      {isFullBleed ? borderlessFace : traditionalFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 7: POCKET BEATS BATTLE CARD (theme-monster)
// --------------------------------------------------------------------------
function CardMonster({ card, backSide }: { card: VaultCard; backSide?: React.ReactNode }) {
  const isFullBleed = card.rarity === 'legendary' || card.rarity === 'mythic';
  
  // HP rating: BPM/Tempo
  const hp = card.tempo;
  
  // Element badge helper
  const mainGenre = card.genre[0] || 'Alternative';
  const renderMonsterEnergyBadge = (genre: string, className = "w-2.5 h-2.5 text-current") => {
    if (genre.includes('Synth') || genre.includes('Outrun') || genre === '🌌') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
      );
    }
    if (genre.includes('Electron') || genre.includes('Dance') || genre === '⚡') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v8h4v10l6-12z" />
        </svg>
      );
    }
    if (genre.includes('Rock') || genre.includes('Metal') || genre === '🎸') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    }
    // Default microphone / pop genre
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    );
  };

  // Rarity Symbol
  const raritySymbol = 
    card.rarity === 'common' ? '●' :
    card.rarity === 'uncommon' ? '◆' : '★';

  const heightClass = 
    card.rarity === 'common' ? 'h-common' :
    card.rarity === 'uncommon' ? 'h-uncommon' :
    card.rarity === 'rare' ? 'h-rare' :
    card.rarity === 'legendary' ? 'h-legendary' : 'h-mythic';

  const finalBack = backSide || <StandardVaultCardBack card={card} />;

  // Attack Damages
  const move1Dmg = Math.round(card.energy * 80) + 10;
  const move2Dmg = Math.round(card.valence * 120) + 20;

  const traditionalFace = (
    <>
      {/* Header */}
      <div className="monster-header">
        <div className="monster-title-block">
          <span className="monster-stage">Basic Song</span>
          <span className="monster-title truncate max-w-[110px]">{card.title}</span>
        </div>
        <div className="monster-hp-block">
          <span className="monster-hp-label">HP</span>
          <span className="monster-hp">{hp}</span>
          <div className="monster-energy-badge flex items-center justify-center">
            {renderMonsterEnergyBadge(mainGenre)}
          </div>
        </div>
      </div>

      {/* Art frame */}
      <div className={`monster-art-frame ${heightClass}`}>
        <img src={card.coverUrl} alt={card.title} className="w-full h-full object-cover" />
      </div>

      {/* Attacks List */}
      <div className="monster-moves-list">
        {/* Attack 1 */}
        <div className="monster-move-row">
          <div className="monster-move-cost">
            <div className="monster-cost-dot flex items-center justify-center">
              {renderMonsterEnergyBadge(mainGenre)}
            </div>
          </div>
          <div className="monster-move-info">
            <span className="monster-move-title">Bass Blast</span>
            <span className="monster-move-desc">A low-end drop that shakes elements.</span>
          </div>
          <span className="monster-move-damage">{move1Dmg}</span>
        </div>

        {/* Attack 2 */}
        <div className="monster-move-row">
          <div className="monster-move-cost">
            <div className="monster-cost-dot flex items-center justify-center">
              {renderMonsterEnergyBadge(mainGenre)}
            </div>
            <div className="monster-cost-dot flex items-center justify-center text-white">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              </svg>
            </div>
          </div>
          <div className="monster-move-info">
            <span className="monster-move-title">Valence Harmony</span>
            <span className="monster-move-desc">Infuses clean emotional resonance.</span>
          </div>
          <span className="monster-move-damage">{move2Dmg}</span>
        </div>
      </div>

      {/* Bottom TCG Weakness slot */}
      <div className="monster-bottom-bar font-mono">
        <div className="monster-bottom-stat flex items-center gap-0.5">
          <span>weakness</span>
          <svg width="8" height="8" viewBox="0 0 24 24" fill={card.mood === 'light' ? '#6b7280' : '#fbbf24'}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
        <div className="monster-bottom-stat">
          <span>resistance</span>
          <span>-30</span>
        </div>
        <span className="monster-rarity-symbol">{raritySymbol}</span>
      </div>
    </>
  );

  const borderlessFace = (
    <div className="relative h-full w-full">
      <img 
        src={card.coverUrl} 
        alt={card.title} 
        className={`absolute inset-0 w-full h-full object-cover z-0 ${card.rarity === 'mythic' ? 'rotate-zoom-mythic' : 'rotate-zoom-art'}`} 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent z-5" />

      {card.rarity === 'mythic' && <div className="mythic-foil-wash" />}

      {/* Full Bleed TCG Overlay layout */}
      <div className="absolute inset-0 z-10 flex flex-col justify-between p-2">
        {/* Header */}
        <div className="monster-header bg-black/60 p-1 rounded border border-white/10">
          <div className="monster-title-block">
            <span className="monster-stage text-[#ffd700]">Legendary Song</span>
            <span className="monster-title truncate max-w-[110px]">{card.title}</span>
          </div>
          <div className="monster-hp-block">
            <span className="monster-hp-label">HP</span>
            <span className="monster-hp text-[#ffd700]">{hp}</span>
            <div className="monster-energy-badge bg-[#ffd700] text-black flex items-center justify-center">
              {renderMonsterEnergyBadge(mainGenre)}
            </div>
          </div>
        </div>

        {/* Bottom Panel (Attacks + TCG Weakness) */}
        <div className="flex flex-col gap-1.5 bg-black/85 p-2 rounded border border-white/10">
          {/* Attack 1 */}
          <div className="monster-move-row border-none bg-transparent p-0">
            <div className="monster-move-cost">
              <div className="monster-cost-dot bg-amber-500 text-black flex items-center justify-center">
                {renderMonsterEnergyBadge(mainGenre)}
              </div>
            </div>
            <div className="monster-move-info">
              <span className="monster-move-title text-[#ffd700]">Mega Bass Wave</span>
              <span className="monster-move-desc">Unleashes a sweeping, intense drop.</span>
            </div>
            <span className="monster-move-damage">{move1Dmg}</span>
          </div>

          <div className="monster-bottom-bar font-mono border-t border-white/10 pt-1 p-0 bg-transparent mt-1">
            <div className="monster-bottom-stat flex items-center gap-0.5">
              <span>weakness</span>
              <svg width="8" height="8" viewBox="0 0 24 24" fill={card.mood === 'light' ? '#6b7280' : '#fbbf24'}>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <div className="monster-bottom-stat">
              <span>resistance</span>
              <span>-30</span>
            </div>
            <span className="monster-rarity-symbol text-[#ffd700]">{raritySymbol}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="monster" backSide={finalBack}>
      {isFullBleed ? borderlessFace : traditionalFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// MAIN SHOWCASE PAGE COMPONENT
// --------------------------------------------------------------------------
export default function CardDesignShowcase() {
  const [activeTab, setActiveTab] = useState<'compare' | 'original' | 'glitch' | 'glass' | 'arcade' | 'mtg' | 'poker' | 'duelist' | 'monster' | 'mint'>('compare');

  // Mint Simulator States
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(['original', 'glitch', 'glass']);
  const [unlockedBackSkins, setUnlockedBackSkins] = useState<string[]>(['original', 'glass']);
  const [sparks, setSparks] = useState<number>(250);
  const [selectedSong, setSelectedSong] = useState<VaultCard>(mockCards[0]);
  const [selectedRarity, setSelectedRarity] = useState<Rarity>('common');
  const [selectedSkin, setSelectedSkin] = useState<string>('original');
  const [selectedBackSkin, setSelectedBackSkin] = useState<string>('original');
  const [mintState, setMintState] = useState<'idle' | 'minting' | 'success'>('idle');
  const [mintLogs, setMintLogs] = useState<string[]>([]);
  const [mintedInventory, setMintedInventory] = useState<{ card: VaultCard; skin: string; backSkin: string }[]>([]);

  // Sparks transaction handler
  const handleUnlockSkin = (skin: string, cost: number) => {
    if (sparks >= cost) {
      setSparks(prev => prev - cost);
      setUnlockedSkins(prev => [...prev, skin]);
    } else {
      alert("Not enough Vault Sparks! Click '+100 Sparks' to reload.");
    }
  };

  const handleUnlockBackSkin = (skin: string, cost: number) => {
    if (sparks >= cost) {
      setSparks(prev => prev - cost);
      setUnlockedBackSkins(prev => [...prev, skin]);
    } else {
      alert("Not enough Vault Sparks! Click '+100 Sparks' to reload.");
    }
  };

  // Simulated Mint sequence
  const handleSimulateMint = () => {
    if (!unlockedSkins.includes(selectedSkin)) {
      alert("Selected Front Skin is locked! Please unlock it first.");
      return;
    }
    if (!unlockedBackSkins.includes(selectedBackSkin)) {
      alert("Selected Back Skin is locked! Please unlock it first.");
      return;
    }
    setMintState('minting');
    setMintLogs([]);

    const logs = [
      "⚡ ESTABLISHING VAULT STATE CONNECTION...",
      "🔐 AUTHORIZING GEN 0 CONTRACT MINT PROTOCOL...",
      `🎨 BOUND FRONT SKIN: ${selectedSkin.toUpperCase()}`,
      `🎨 BOUND BACK SKIN: ${selectedBackSkin.toUpperCase()}`,
      `📝 BINDING METADATA: "${selectedSong.title}"`,
      `🧬 rarity: ${selectedRarity.toUpperCase()} // day: #${String(selectedSong.day).padStart(3, '0')}`,
      "🔒 GENERATING ON-CHAIN TOKEN RECORD...",
      "📡 BROADCASTING META-INJECTION COMPLETE...",
      "🎉 SUCCESS! daily-card-token INITIALIZED IN SESSION INVENTORY."
    ];

    logs.forEach((log, index) => {
      setTimeout(() => {
        setMintLogs(prev => [...prev, log]);
        if (index === logs.length - 1) {
          setTimeout(() => {
            const cardCopy: VaultCard = {
              ...selectedSong,
              id: `minted-${Date.now()}`,
              rarity: selectedRarity,
              claimedCount: selectedSong.claimedCount + 1,
            };
            setMintedInventory(prev => [{ card: cardCopy, skin: selectedSkin, backSkin: selectedBackSkin }, ...prev]);
            setMintState('success');
          }, 400);
        }
      }, (index + 1) * 300);
    });
  };

  // Helper to render configured card back
  const renderCardBack = (card: VaultCard, backSkin: string) => {
    if (backSkin === 'original') return <BackOriginal card={card} />;
    if (backSkin === 'glitch') return <BackGlitch card={card} />;
    if (backSkin === 'glass') return <BackGlass card={card} />;
    if (backSkin === 'arcade') return <BackArcade card={card} />;
    if (backSkin === 'mtg') return <BackMtg card={card} />;
    if (backSkin === 'poker') return <BackPoker card={card} />;
    if (backSkin === 'duelist') return <BackDuelist card={card} />;
    return <BackMonster card={card} />;
  };

  // Helper to render configured card preview
  const renderCardWithSkin = (card: VaultCard, skin: string, backSkin = 'original') => {
    const backSide = renderCardBack(card, backSkin);
    if (skin === 'original') return <CardOriginal card={card} backSide={backSide} />;
    if (skin === 'glitch') return <CardGlitch card={card} backSide={backSide} />;
    if (skin === 'glass') return <CardGlass card={card} backSide={backSide} />;
    if (skin === 'arcade') return <CardArcade card={card} backSide={backSide} />;
    if (skin === 'mtg') return <CardMtg card={card} backSide={backSide} />;
    if (skin === 'poker') return <CardPoker card={card} backSide={backSide} />;
    if (skin === 'duelist') return <CardDuelist card={card} backSide={backSide} />;
    return <CardMonster card={card} backSide={backSide} />;
  };

  return (
    <div className="showcase-page">
      {/* Dev Navigation header */}
      <div className="mb-4">
        <a 
          href="/admin" 
          className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white no-underline border border-white/20 px-3 py-1.5 rounded bg-white/5 transition-all"
        >
          <ChevronLeft size={14} />
          <span>Return to Admin Console</span>
        </a>
      </div>

      {/* Main Controls Panel */}
      <div className="showcase-controls">
        <div className="showcase-title-row">
          <div>
            <h1 className="showcase-title">Vault Card Design Lab</h1>
            <p className="showcase-subtitle">Interactive showcase comparing card layout systems featuring graduating artwork dimensions</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ff3800]/10 border border-[#ff3800]/30 rounded">
            <RotateCcw size={14} className="text-[#ff3800] animate-spin" style={{ animationDuration: '6s' }} />
            <span className="text-[10px] text-[#ff3800] font-black uppercase tracking-wider">Lab Workspace Active</span>
          </div>
        </div>

        {/* Interactive selectors */}
        <div className="controls-row">
          <div className="control-group flex-wrap gap-y-2">
            <span className="control-label mr-2">Select Workspace View:</span>
            <button 
              className={`btn-tab ${activeTab === 'compare' ? 'active' : ''}`}
              onClick={() => setActiveTab('compare')}
            >
              Side-by-side
            </button>
            <button 
              className={`btn-tab ${activeTab === 'original' ? 'active' : ''}`}
              onClick={() => setActiveTab('original')}
            >
              Original Style
            </button>
            <button 
              className={`btn-tab ${activeTab === 'glitch' ? 'active' : ''}`}
              onClick={() => setActiveTab('glitch')}
            >
              Neon-Brutalist
            </button>
            <button 
              className={`btn-tab ${activeTab === 'glass' ? 'active' : ''}`}
              onClick={() => setActiveTab('glass')}
            >
              Frosted Glass
            </button>
            <button 
              className={`btn-tab ${activeTab === 'arcade' ? 'active' : ''}`}
              onClick={() => setActiveTab('arcade')}
            >
              Retro-Arcade 80s
            </button>
            <button 
              className={`btn-tab ${activeTab === 'mtg' ? 'active' : ''}`}
              onClick={() => setActiveTab('mtg')}
            >
              MTG Layout
            </button>
            <button 
              className={`btn-tab ${activeTab === 'poker' ? 'active' : ''}`}
              onClick={() => setActiveTab('poker')}
            >
              Classic Poker
            </button>
            <button 
              className={`btn-tab ${activeTab === 'duelist' ? 'active' : ''}`}
              onClick={() => setActiveTab('duelist')}
            >
              Duelist Frame
            </button>
            <button 
              className={`btn-tab ${activeTab === 'monster' ? 'active' : ''}`}
              onClick={() => setActiveTab('monster')}
            >
              Pocket Beats
            </button>
            <button 
              className={`btn-tab ${activeTab === 'mint' ? 'active' : ''} border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700]/10`}
              onClick={() => setActiveTab('mint')}
            >
              🌌 Mint Theme Selector
            </button>
          </div>
        </div>
      </div>

      {/* Grid rendering options */}
      {activeTab === 'compare' ? (
        <div className="flex flex-col gap-12">
          {/* Row 0: Original Production Style */}
          <div>
            <h2 className="section-title text-[#8a8ea0] border-b border-[#8a8ea0]/20 pb-2">
              Concept 0: Original Production Style
            </h2>
            <p className="text-[11px] text-white/50 mb-4 font-mono uppercase tracking-wide">
              The standard production layouts. Artwork height progresses from bounded (Common/Uncommon), to vertical full-bleed (Rare), to rotated & zoomed full-bleed cards (Legendary/Mythic) with standard footer stats.
            </p>
            <div className="showcase-grid">
              {mockCards.map(card => (
                <div key={`original-${card.id}`} className="rarity-column">
                  <div className="rarity-column-title text-center text-xs py-1 font-mono uppercase border border-white/20 bg-white/5">
                    {card.rarity}
                  </div>
                  <CardOriginal card={card} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 1: Neon-Brutalist */}
          <div>
            <h2 className="section-title text-[#ff3800] border-b border-[#ff3800]/20 pb-2">
              Concept 1: Neon-Brutalist Glitch
            </h2>
            <p className="text-[11px] text-white/50 mb-4 font-mono uppercase tracking-wide">
              High contrast industrial layout. Artwork size scales from bounded boxes (Common/Uncommon) to vertical full-bleed (Rare) and full-bleed rotated & zoomed (Legendary/Mythic) with floating overlays.
            </p>
            <div className="showcase-grid">
              {mockCards.map(card => (
                <div key={`glitch-${card.id}`} className="rarity-column">
                  <div className="rarity-column-title text-center text-xs py-1 font-mono uppercase border border-white/20 bg-white/5">
                    {card.rarity}
                  </div>
                  <CardGlitch card={card} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 2: Frosted Glassmorphism */}
          <div className="comparison-section">
            <h2 className="section-title text-[#00f0ff] border-b border-[#00f0ff]/20 pb-2">
              Concept 2: Glass-Outrun Minimalist
            </h2>
            <p className="text-[11px] text-white/50 mb-4 font-mono uppercase tracking-wide">
              Sleek frosted-glass paneling. Features smaller art in low rarities, expanding to vertical full-bleed (Rare) and rotated/zoomed full-bleed cards (Legendary/Mythic) with translucent floating drawers.
            </p>
            <div className="showcase-grid">
              {mockCards.map(card => (
                <div key={`glass-${card.id}`} className="rarity-column">
                  <div className="rarity-column-title text-center text-xs py-1 font-mono uppercase border border-white/20 bg-white/5">
                    {card.rarity}
                  </div>
                  <CardGlass card={card} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 3: Retro Synthesizer Deck */}
          <div className="comparison-section">
            <h2 className="section-title text-[#ffb800] border-b border-[#ffb800]/20 pb-2">
              Concept 3: Retro-Arcade 80s
            </h2>
            <p className="text-[11px] text-white/50 mb-4 font-mono uppercase tracking-wide">
              Synth-deck inspired layout. Graduating art containers combined with glowing vector perspective wireframes (Legendary/Mythic rotated & zoomed) and pixel step sequencers.
            </p>
            <div className="showcase-grid">
              {mockCards.map(card => (
                <div key={`arcade-${card.id}`} className="rarity-column">
                  <div className="rarity-column-title text-center text-xs py-1 font-mono uppercase border border-white/20 bg-white/5">
                    {card.rarity}
                  </div>
                  <CardArcade card={card} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 4: Magic: The Gathering (MTG) */}
          <div className="comparison-section">
            <h2 className="section-title text-[#a8825c] border-b border-[#a8825c]/20 pb-2">
              Concept 4: Magic: The Gathering (MTG) Classic & Borderless
            </h2>
            <p className="text-[11px] text-white/50 mb-4 font-mono uppercase tracking-wide">
              Cyberpunk Glassmorphism edition of standard MTG. Rules textboxes and title bars are styled as glass slabs with modern sans-serif fonts. Rare cards feature full-screen vertical artwork, and Legendary/Mythic cards feature full-screen rotated & zoomed artwork.
            </p>
            <div className="showcase-grid">
              {mockCards.map(card => (
                <div key={`mtg-${card.id}`} className="rarity-column">
                  <div className="rarity-column-title text-center text-xs py-1 font-mono uppercase border border-white/20 bg-white/5">
                    {card.rarity}
                  </div>
                  <CardMtg card={card} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 5: Classic Poker */}
          <div className="comparison-section">
            <h2 className="section-title text-[#c8a97e] border-b border-[#c8a97e]/20 pb-2">
              Concept 5: Classic Poker / Tarot Playing Card
            </h2>
            <p className="text-[11px] text-white/50 mb-4 font-mono uppercase tracking-wide">
              Traditional card deck layouts. Features vintage indices, suit cards, oval artwork frames, and mirrored text dividers (with full-art gold filigree tarot setups for Legendary/Mythic).
            </p>
            <div className="showcase-grid">
              {mockCards.map(card => (
                <div key={`poker-${card.id}`} className="rarity-column">
                  <div className="rarity-column-title text-center text-xs py-1 font-mono uppercase border border-white/20 bg-white/5">
                    {card.rarity}
                  </div>
                  <CardPoker card={card} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 6: Duelist Frame */}
          <div className="comparison-section">
            <h2 className="section-title text-[#b9783f] border-b border-[#b9783f]/20 pb-2">
              Concept 6: Duelist Monster Card
            </h2>
            <p className="text-[11px] text-white/50 mb-4 font-mono uppercase tracking-wide">
              Inspired by Yu-Gi-Oh!. Features Normal/Effect orange backings, Synchro white borders, Xyz black layers, star rank levels, element attributes, and ATK/DEF stat parameters.
            </p>
            <div className="showcase-grid">
              {mockCards.map(card => (
                <div key={`duelist-${card.id}`} className="rarity-column">
                  <div className="rarity-column-title text-center text-xs py-1 font-mono uppercase border border-white/20 bg-white/5">
                    {card.rarity}
                  </div>
                  <CardDuelist card={card} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 7: Pocket Beats */}
          <div className="comparison-section">
            <h2 className="section-title text-[#eab308] border-b border-[#eab308]/20 pb-2">
              Concept 7: Pocket Beats Battle Card
            </h2>
            <p className="text-[11px] text-white/50 mb-4 font-mono uppercase tracking-wide">
              Inspired by Pokémon TCG. Features HP values (representing BPM), yellow card frames, element cost configurations, attack descriptions, and weaknesses stats.
            </p>
            <div className="showcase-grid">
              {mockCards.map(card => (
                <div key={`monster-${card.id}`} className="rarity-column">
                  <div className="rarity-column-title text-center text-xs py-1 font-mono uppercase border border-white/20 bg-white/5">
                    {card.rarity}
                  </div>
                  <CardMonster card={card} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'mint' ? (
        /* Mint Configuration Simulator Tab */
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="section-title text-[#ffd700] border-b border-[#ffd700]/20 pb-2 font-mono">
              🌌 Player Mint Configuration Simulator
            </h2>
            <p className="text-[11px] text-white/60 mt-1 mb-6 max-w-2xl font-mono uppercase tracking-wider leading-relaxed">
              Demonstrates the upcoming Web3 front-end flow. Players can unlock custom skin designs using daily Vault Sparks, choose which layout style to apply before minting, and preview the cards dynamically.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left Column: Controls */}
            <div className="bg-[#0c0a07] border-2 border-white/10 rounded-lg p-6 flex flex-col gap-6">
              
              {/* Sparks Counter */}
              <div className="flex justify-between items-center bg-black/40 border border-white/5 p-3 rounded">
                <div className="flex flex-col">
                  <span className="text-[8px] text-white/40 uppercase tracking-widest font-mono">Vault Balance</span>
                  <span className="text-sm font-black text-[#ffd700] font-mono">⚡ {sparks} Sparks</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSparks(prev => prev + 100)} 
                    className="text-[9px] font-mono border border-[#ffd700]/40 text-[#ffd700] bg-[#ffd700]/5 hover:bg-[#ffd700]/20 px-2 py-1 rounded"
                  >
                    +100 Sparks
                  </button>
                  <button 
                    onClick={() => { 
                      setSparks(250); 
                      setUnlockedSkins(['original', 'glitch', 'glass']); 
                      setUnlockedBackSkins(['original', 'glass']); 
                      setSelectedSkin('original');
                      setSelectedBackSkin('original');
                    }} 
                    className="text-[9px] font-mono border border-white/20 text-white/50 hover:bg-white/5 px-2 py-1 rounded"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* 1. Song Choice */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-mono">1. Select Song Catalog Track:</label>
                <select 
                  value={selectedSong.id} 
                  onChange={(e) => setSelectedSong(mockCards.find(c => c.id === e.target.value) || mockCards[0])}
                  className="bg-black border border-white/20 rounded p-2 text-xs font-mono text-white focus:outline-none focus:border-[#ff3800]"
                >
                  {mockCards.map(c => (
                    <option key={c.id} value={c.id}>
                      Day {c.day} · {c.title} ({c.genre[0]})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Rarity Choice */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-mono">2. Select Card Rarity Tier:</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['common', 'uncommon', 'rare', 'legendary', 'mythic'] as Rarity[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedRarity(r)}
                      className={`px-3 py-1.5 border rounded text-[9px] font-mono uppercase tracking-wider transition-all ${
                        selectedRarity === r 
                          ? 'bg-white/10 text-white font-bold' 
                          : 'border-white/10 text-white/40 hover:text-white/80'
                      }`}
                      style={{ borderLeftColor: RARITY_COLORS[r], borderLeftWidth: selectedRarity === r ? '4px' : '2px' }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Skin Selection (Front) */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-mono">3. Select Card Front Skin:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'original', name: 'Original Front', cost: 0 },
                    { id: 'glitch', name: 'Neon-Brutalist', cost: 0 },
                    { id: 'glass', name: 'Frosted Glass', cost: 0 },
                    { id: 'arcade', name: 'Retro-Arcade', cost: 50 },
                    { id: 'mtg', name: 'Magic Layout', cost: 100 },
                    { id: 'poker', name: 'Classic Poker', cost: 50 },
                    { id: 'duelist', name: 'Duelist Frame', cost: 75 },
                    { id: 'monster', name: 'Pocket Beats', cost: 75 }
                  ].map(skin => {
                    const isUnlocked = unlockedSkins.includes(skin.id);
                    const isSelected = selectedSkin === skin.id;

                    return (
                      <div 
                        key={skin.id}
                        onClick={() => isUnlocked && setSelectedSkin(skin.id)}
                        className={`border rounded p-2 flex flex-col justify-between h-[64px] transition-all ${
                          isUnlocked 
                            ? isSelected 
                              ? 'border-[#ff3800] bg-[#ff3800]/5 cursor-pointer' 
                              : 'border-white/15 bg-black/40 hover:border-white/30 cursor-pointer'
                            : 'border-white/5 bg-black/20 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`text-[9.5px] font-bold font-mono ${isSelected && isUnlocked ? 'text-[#ff3800]' : 'text-white'}`}>
                            {skin.name}
                          </span>
                          {!isUnlocked && <span className="text-[9px]">🔒</span>}
                        </div>

                        <div className="mt-auto">
                          {isUnlocked ? (
                            <span className="text-[7.5px] text-emerald-400 font-mono font-bold uppercase tracking-wider">Unlocked</span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlockSkin(skin.id, skin.cost);
                              }}
                              className="w-full text-center text-[7.5px] font-mono font-bold uppercase tracking-wider bg-[#ffd700] hover:bg-[#ffe240] text-black py-0.5 px-1 rounded transition-all"
                            >
                              Unlock ({skin.cost} ⚡)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Skin Selection (Back) */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-mono">4. Select Card Back Skin:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'original', name: 'Original Back', cost: 0 },
                    { id: 'glass', name: 'Frosted Glass', cost: 0 },
                    { id: 'glitch', name: 'Neon-Brutalist', cost: 25 },
                    { id: 'arcade', name: 'Retro-Arcade', cost: 40 },
                    { id: 'mtg', name: 'Magic Layout', cost: 60 },
                    { id: 'poker', name: 'Classic Poker', cost: 40 },
                    { id: 'duelist', name: 'Duelist Frame', cost: 50 },
                    { id: 'monster', name: 'Pocket Beats', cost: 50 }
                  ].map(skin => {
                    const isUnlocked = unlockedBackSkins.includes(skin.id);
                    const isSelected = selectedBackSkin === skin.id;

                    return (
                      <div 
                        key={skin.id}
                        onClick={() => isUnlocked && setSelectedBackSkin(skin.id)}
                        className={`border rounded p-2 flex flex-col justify-between h-[64px] transition-all ${
                          isUnlocked 
                            ? isSelected 
                              ? 'border-[#ff3800] bg-[#ff3800]/5 cursor-pointer' 
                              : 'border-white/15 bg-black/40 hover:border-white/30 cursor-pointer'
                            : 'border-white/5 bg-black/20 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`text-[9.5px] font-bold font-mono ${isSelected && isUnlocked ? 'text-[#ff3800]' : 'text-white'}`}>
                            {skin.name}
                          </span>
                          {!isUnlocked && <span className="text-[9px]">🔒</span>}
                        </div>

                        <div className="mt-auto">
                          {isUnlocked ? (
                            <span className="text-[7.5px] text-emerald-400 font-mono font-bold uppercase tracking-wider">Unlocked</span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlockBackSkin(skin.id, skin.cost);
                              }}
                              className="w-full text-center text-[7.5px] font-mono font-bold uppercase tracking-wider bg-[#ffd700] hover:bg-[#ffe240] text-black py-0.5 px-1 rounded transition-all"
                            >
                              Unlock ({skin.cost} ⚡)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mint Trigger */}
              <div className="mt-2">
                {mintState === 'minting' ? (
                  <button disabled className="w-full font-mono font-bold text-xs uppercase tracking-widest bg-white/5 border border-white/20 text-white/30 py-3 rounded cursor-not-allowed">
                    ⚙️ Executing Blockchain Authorization...
                  </button>
                ) : (
                  <button
                    onClick={handleSimulateMint}
                    className="w-full font-mono font-bold text-xs uppercase tracking-widest bg-[#ff3800] hover:bg-[#ff5020] text-black py-3 rounded transition-all shadow-md active:scale-[0.98]"
                  >
                    Confirm & Mint daily-card-token
                  </button>
                )}
              </div>

            </div>

            {/* Right Column: Holographic Preview */}
            <div className="flex flex-col items-center gap-4 bg-[#0a0806] border border-white/10 rounded-lg p-6 min-h-[420px] justify-center">
              <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono border-b border-white/10 pb-1 mb-2">
                Holographic Preview (Click to Flip)
              </span>
              
              <div className="w-[200px] aspect-[3/4]">
                {renderCardWithSkin(
                  {
                    ...selectedSong,
                    rarity: selectedRarity
                  },
                  selectedSkin,
                  selectedBackSkin
                )}
              </div>

              <span className="text-[8px] text-white/30 font-mono text-center max-w-[220px] leading-normal">
                * PREVIEW RENDERS FRONT: <span className="text-[#ffd700] font-bold">{selectedSkin.toUpperCase()}</span> BACK: <span className="text-[#ffd700] font-bold">{selectedBackSkin.toUpperCase()}</span> AT RARITY <span className="text-[#ff3800] font-bold">{selectedRarity.toUpperCase()}</span>
              </span>
            </div>
          </div>

          {/* Terminal Console Logs & Success Splash */}
          {mintState === 'minting' && (
            <div className="bg-black border border-emerald-500/20 rounded p-4 font-mono text-xs text-emerald-400 flex flex-col gap-1.5 shadow-lg">
              <span className="text-[10px] text-emerald-500/60 uppercase tracking-wider border-b border-emerald-500/10 pb-1 mb-1 font-bold">
                Console readout log / telemetry readout
              </span>
              {mintLogs.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-emerald-500/40">[{idx + 1}]</span>
                  <span>{log}</span>
                </div>
              ))}
              <div className="flex gap-1.5 items-center mt-1 text-emerald-300 font-bold animate-pulse">
                <span>▶</span>
                <span className="w-1.5 h-3 bg-emerald-300" />
              </div>
            </div>
          )}

          {mintState === 'success' && (
            <div className="bg-emerald-950/20 border-2 border-emerald-500/40 rounded-lg p-5 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg animate-bounce" style={{ animationIterationCount: 1, animationDuration: '0.6s' }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <div className="flex flex-col">
                  <span className="font-bold text-emerald-400 font-mono text-xs uppercase tracking-widest">daily-card-token minted successfully!</span>
                  <span className="text-[10px] text-white/60 mt-0.5 font-mono">The card has been registered and added to your session inventory below.</span>
                </div>
              </div>
              <button 
                onClick={() => setMintState('idle')} 
                className="px-4 py-1.5 border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-black font-mono font-bold text-xs uppercase rounded transition-all"
              >
                Mint Another
              </button>
            </div>
          )}

          {/* Minted Inventory */}
          <div className="border-t border-white/10 pt-8 mt-4">
            <h3 className="section-title text-white font-mono mb-4">
              🎒 Your Session Card Inventory ({mintedInventory.length})
            </h3>
            
            {mintedInventory.length === 0 ? (
              <div className="text-center py-10 bg-black/20 border border-dashed border-white/10 rounded font-mono text-xs text-white/40 uppercase tracking-wider">
                No cards minted in this session yet. Complete the configuration steps above.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {mintedInventory.map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-2">
                    <div className="aspect-[3/4]">
                      {renderCardWithSkin(item.card, item.skin, item.backSkin)}
                    </div>
                    <div className="text-center flex flex-col mt-1">
                      <span className="text-[9px] font-black text-white font-mono uppercase truncate max-w-full block mb-0.5">
                        {item.card.title}
                      </span>
                      <span className="text-[7px] text-white/50 font-mono uppercase tracking-wider block">
                        F: {item.skin === 'original' ? 'Original' : item.skin === 'glitch' ? 'Brutalist' : item.skin === 'glass' ? 'Glass' : item.skin === 'arcade' ? 'Arcade' : item.skin === 'mtg' ? 'MTG' : item.skin === 'poker' ? 'Poker' : item.skin === 'duelist' ? 'Duelist' : 'Beats'}
                      </span>
                      <span className="text-[7px] text-[#ffd700]/60 font-mono uppercase tracking-wider block mt-0.5">
                        B: {item.backSkin === 'original' ? 'Original' : item.backSkin === 'glitch' ? 'Brutalist' : item.backSkin === 'glass' ? 'Glass' : item.backSkin === 'arcade' ? 'Arcade' : item.backSkin === 'mtg' ? 'MTG' : item.backSkin === 'poker' ? 'Poker' : item.backSkin === 'duelist' ? 'Duelist' : 'Beats'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <h2 className="section-title border-b border-white/10 pb-2">
            {activeTab === 'original' && 'Concept 0: Original Production Style'}
            {activeTab === 'glitch' && 'Concept 1: Neon-Brutalist Glitch'}
            {activeTab === 'glass' && 'Concept 2: Glass-Outrun Minimalist'}
            {activeTab === 'arcade' && 'Concept 3: Retro-Arcade 80s'}
            {activeTab === 'mtg' && 'Concept 4: Magic: The Gathering (MTG) Classic'}
            {activeTab === 'poker' && 'Concept 5: Classic Poker / Tarot Playing Card'}
            {activeTab === 'duelist' && 'Concept 6: Duelist Monster Card'}
            {activeTab === 'monster' && 'Concept 7: Pocket Beats Battle Card'}
          </h2>
          <div className="showcase-grid mt-6">
            {mockCards.map(card => (
              <div key={card.id} className="rarity-column">
                <div className="rarity-column-title text-center text-xs py-1.5 font-bold uppercase border border-white/20 bg-white/5">
                  {card.rarity}
                </div>
                {activeTab === 'original' && <CardOriginal card={card} />}
                {activeTab === 'glitch' && <CardGlitch card={card} />}
                {activeTab === 'glass' && <CardGlass card={card} />}
                {activeTab === 'arcade' && <CardArcade card={card} />}
                {activeTab === 'mtg' && <CardMtg card={card} />}
                {activeTab === 'poker' && <CardPoker card={card} />}
                {activeTab === 'duelist' && <CardDuelist card={card} />}
                {activeTab === 'monster' && <CardMonster card={card} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Instructions */}
      <div className="mt-12 text-center text-[10px] text-white/30 font-mono border-t border-white/10 pt-4">
        * DEVS NOTICE: CLICK INDIVIDUAL CARDS TO TOGGLE FRONT/BACK RENDER STATES AND VIEW CORRESPONDING SYSTEM SCHEMATICS
      </div>
    </div>
  );
}
