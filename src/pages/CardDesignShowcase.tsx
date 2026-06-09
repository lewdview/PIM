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
                className="w-16 h-16 rounded-xl border-2 flex items-center justify-center"
                style={{
                  background: `linear-gradient(145deg, ${rcColor}18, transparent)`,
                  borderColor: `${rcColor}30`,
                  boxShadow: `0 0 30px ${rcColor}10, inset 0 0 16px ${rcColor}05`,
                }}
              >
                <span 
                  className="font-black text-2xl uppercase tracking-tighter"
                  style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    color: rcColor,
                    textShadow: `0 0 18px ${rcColor}60`
                  }}
                >
                  V
                </span>
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
// DESIGN 1: NEON-BRUTALIST GLITCH (High Contrast Cyberpunk)
// --------------------------------------------------------------------------
function CardGlitch({ card }: { card: VaultCard }) {
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

  const backFace = <StandardVaultCardBack card={card} />;

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="glitch" backSide={backFace}>
      {frontFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 2: GLASS-OUTRUN MINIMALIST (Premium Sleek Glassmorphism)
// --------------------------------------------------------------------------
function CardGlass({ card }: { card: VaultCard }) {
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

  const backFace = <StandardVaultCardBack card={card} />;

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="glass" backSide={backFace}>
      {frontFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 3: RETRO-ARCADE 80s (Vintage Synthesizer Deck)
// --------------------------------------------------------------------------
function CardArcade({ card }: { card: VaultCard }) {
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

  const backFace = <StandardVaultCardBack card={card} />;

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="arcade" backSide={backFace}>
      {frontFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 4: MAGIC: THE GATHERING (MTG Glass-Outrun Hybrid Edition)
// --------------------------------------------------------------------------
function CardMtg({ card }: { card: VaultCard }) {
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

  const backFace = <StandardVaultCardBack card={card} />;

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="mtg" backSide={backFace}>
      {isFullBleed ? borderlessFace : traditionalFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 5: CLASSIC TAROT / POKER PLAYING CARD (theme-poker)
// --------------------------------------------------------------------------
function CardPoker({ card }: { card: VaultCard }) {
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

  const backFace = <StandardVaultCardBack card={card} />;

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
    <Card3DWrapper rarity={card.rarity} themeClass="poker" backSide={backFace}>
      {isFullBleed ? borderlessFace : traditionalFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 6: DUELIST MONSTER CARD (theme-duelist)
// --------------------------------------------------------------------------
function CardDuelist({ card }: { card: VaultCard }) {
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

  const backFace = <StandardVaultCardBack card={card} />;

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
    <Card3DWrapper rarity={card.rarity} themeClass="duelist" backSide={backFace}>
      {isFullBleed ? borderlessFace : traditionalFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 7: POCKET BEATS BATTLE CARD (theme-monster)
// --------------------------------------------------------------------------
function CardMonster({ card }: { card: VaultCard }) {
  const isFullBleed = card.rarity === 'legendary' || card.rarity === 'mythic';
  
  // HP rating: BPM/Tempo
  const hp = card.tempo;
  
  // Element badge
  const mainGenre = card.genre[0] || 'Alternative';
  const getElementBadge = (genre: string) => {
    if (genre.includes('Synth') || genre.includes('Outrun')) return '🌌';
    if (genre.includes('Electron') || genre.includes('Dance')) return '⚡';
    if (genre.includes('Rock') || genre.includes('Metal')) return '🎸';
    return '🎤';
  };
  const elementBadge = getElementBadge(mainGenre);

  // Rarity Symbol
  const raritySymbol = 
    card.rarity === 'common' ? '●' :
    card.rarity === 'uncommon' ? '◆' : '★';

  const heightClass = 
    card.rarity === 'common' ? 'h-common' :
    card.rarity === 'uncommon' ? 'h-uncommon' :
    card.rarity === 'rare' ? 'h-rare' :
    card.rarity === 'legendary' ? 'h-legendary' : 'h-mythic';

  const backFace = <StandardVaultCardBack card={card} />;

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
          <div className="monster-energy-badge">{elementBadge}</div>
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
            <div className="monster-cost-dot">{elementBadge}</div>
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
            <div className="monster-cost-dot">{elementBadge}</div>
            <div className="monster-cost-dot">💿</div>
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
        <div className="monster-bottom-stat">
          <span>weakness</span>
          <span className="text-red-500">{card.mood === 'light' ? '🖤' : '💛'}</span>
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
            <div className="monster-energy-badge bg-[#ffd700] text-black">{elementBadge}</div>
          </div>
        </div>

        {/* Bottom Panel (Attacks + TCG Weakness) */}
        <div className="flex flex-col gap-1.5 bg-black/85 p-2 rounded border border-white/10">
          {/* Attack 1 */}
          <div className="monster-move-row border-none bg-transparent p-0">
            <div className="monster-move-cost">
              <div className="monster-cost-dot bg-amber-500 text-black">{elementBadge}</div>
            </div>
            <div className="monster-move-info">
              <span className="monster-move-title text-[#ffd700]">Mega Bass Wave</span>
              <span className="monster-move-desc">Unleashes a sweeping, intense drop.</span>
            </div>
            <span className="monster-move-damage">{move1Dmg}</span>
          </div>

          <div className="monster-bottom-bar font-mono border-t border-white/10 pt-1 p-0 bg-transparent mt-1">
            <div className="monster-bottom-stat">
              <span>weakness</span>
              <span className="text-red-500">{card.mood === 'light' ? '🖤' : '💛'}</span>
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
    <Card3DWrapper rarity={card.rarity} themeClass="monster" backSide={backFace}>
      {isFullBleed ? borderlessFace : traditionalFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// MAIN SHOWCASE PAGE COMPONENT
// --------------------------------------------------------------------------
export default function CardDesignShowcase() {
  const [activeTab, setActiveTab] = useState<'compare' | 'glitch' | 'glass' | 'arcade' | 'mtg' | 'poker' | 'duelist' | 'monster' | 'mint'>('compare');

  // Mint Simulator States
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(['glitch', 'glass']);
  const [sparks, setSparks] = useState<number>(250);
  const [selectedSong, setSelectedSong] = useState<VaultCard>(mockCards[0]);
  const [selectedRarity, setSelectedRarity] = useState<Rarity>('common');
  const [selectedSkin, setSelectedSkin] = useState<string>('glitch');
  const [mintState, setMintState] = useState<'idle' | 'minting' | 'success'>('idle');
  const [mintLogs, setMintLogs] = useState<string[]>([]);
  const [mintedInventory, setMintedInventory] = useState<{ card: VaultCard; skin: string }[]>([]);

  // Sparks transaction handler
  const handleUnlockSkin = (skin: string, cost: number) => {
    if (sparks >= cost) {
      setSparks(prev => prev - cost);
      setUnlockedSkins(prev => [...prev, skin]);
    } else {
      alert("Not enough Vault Sparks! Click '+100 Sparks' to reload.");
    }
  };

  // Simulated Mint sequence
  const handleSimulateMint = () => {
    if (!unlockedSkins.includes(selectedSkin)) {
      alert("This skin is locked! Please unlock it first.");
      return;
    }
    setMintState('minting');
    setMintLogs([]);

    const logs = [
      "⚡ ESTABLISHING VAULT STATE CONNECTION...",
      "🔐 AUTHORIZING GEN 0 CONTRACT MINT PROTOCOL...",
      `🎨 BOUND SKIN PATTERN: ${selectedSkin.toUpperCase()}`,
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
            setMintedInventory(prev => [{ card: cardCopy, skin: selectedSkin }, ...prev]);
            setMintState('success');
          }, 400);
        }
      }, (index + 1) * 300);
    });
  };

  // Helper to render configured card preview
  const renderCardWithSkin = (card: VaultCard, skin: string) => {
    if (skin === 'glitch') return <CardGlitch card={card} />;
    if (skin === 'glass') return <CardGlass card={card} />;
    if (skin === 'arcade') return <CardArcade card={card} />;
    if (skin === 'mtg') return <CardMtg card={card} />;
    if (skin === 'poker') return <CardPoker card={card} />;
    if (skin === 'duelist') return <CardDuelist card={card} />;
    return <CardMonster card={card} />;
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
                    onClick={() => { setSparks(250); setUnlockedSkins(['glitch', 'glass']); }} 
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

              {/* 3. Skin Selection & Achievements */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-mono">3. Apply Unlocked Card Front Skin:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
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
                        className={`border rounded p-2.5 flex flex-col justify-between h-20 transition-all ${
                          isUnlocked 
                            ? isSelected 
                              ? 'border-[#ff3800] bg-[#ff3800]/5 cursor-pointer' 
                              : 'border-white/15 bg-black/40 hover:border-white/30 cursor-pointer'
                            : 'border-white/5 bg-black/20 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`text-[10px] font-bold font-mono ${isSelected && isUnlocked ? 'text-[#ff3800]' : 'text-white'}`}>
                            {skin.name}
                          </span>
                          {!isUnlocked && <span className="text-[9px]">🔒</span>}
                        </div>

                        {/* Unlock buttons / info */}
                        <div className="mt-auto">
                          {isUnlocked ? (
                            <span className="text-[8px] text-emerald-400 font-mono font-bold uppercase tracking-wider">Unlocked</span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlockSkin(skin.id, skin.cost);
                              }}
                              className="w-full text-center text-[8px] font-mono font-bold uppercase tracking-wider bg-[#ffd700] hover:bg-[#ffe240] text-black py-1 px-1.5 rounded transition-all"
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
                  selectedSkin
                )}
              </div>

              <span className="text-[8px] text-white/30 font-mono text-center max-w-[200px]">
                * PREVIEW RENDERS SKIN: <span className="text-[#ffd700] font-bold">{selectedSkin.toUpperCase()}</span> AT RARITY <span className="text-[#ff3800] font-bold">{selectedRarity.toUpperCase()}</span>
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
                      {renderCardWithSkin(item.card, item.skin)}
                    </div>
                    <div className="text-center flex flex-col">
                      <span className="text-[9px] font-black text-white font-mono uppercase truncate max-w-full">
                        {item.card.title}
                      </span>
                      <span className="text-[7.5px] text-white/40 font-mono uppercase tracking-widest">
                        {item.skin === 'glitch' ? 'Brutalist' : item.skin === 'glass' ? 'Glass' : item.skin === 'arcade' ? 'Arcade' : item.skin === 'mtg' ? 'MTG Edition' : item.skin === 'poker' ? 'Poker' : item.skin === 'duelist' ? 'Duelist' : 'Pocket Beats'}
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
