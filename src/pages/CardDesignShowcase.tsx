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
// DESIGN 1: NEON-BRUTALIST GLITCH
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

  const frontFace = (
    <div className="flex flex-col h-full relative overflow-hidden select-none">
      {/* Background patterns */}
      {card.rarity === 'mythic' && <div className="mythic-foil-wash" />}
      {card.rarity === 'rare' && <div className="terminal-scanline" />}

      {/* Header */}
      <div className="flex justify-between items-center mb-1 z-10">
        <span className="font-mono text-[10px]" style={{ color: activeColor }}>
          SYS.LOC // #{String(card.day).padStart(3, '0')}
        </span>
        <span className="brutalist-badge">{card.rarity}</span>
      </div>

      {/* Album Art Cover */}
      <div className="card-image-box h-[45%] border-2 border-black relative">
        <img src={card.coverUrl} alt={card.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        
        {/* Play indicator */}
        <div className="absolute bottom-2 right-2 p-1 bg-black border border-white/40 rounded">
          <Play size={10} style={{ color: activeColor }} />
        </div>
      </div>

      {/* Metadata Detail */}
      <div className="card-info-box flex flex-col flex-1 pt-2 z-10">
        {card.rarity === 'legendary' && <div className="hazard-strip mb-2" />}

        <h3 className="brutalist-title text-sm font-black tracking-tight leading-none truncate mb-1">
          {card.title}
        </h3>

        {/* Tags */}
        <div className="flex gap-1 mb-2 overflow-hidden whitespace-nowrap">
          {card.tags.map(tag => (
            <span key={tag} className="text-[8px] px-1 bg-white/10 text-white/70 border border-white/20 uppercase">
              {tag}
            </span>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-columns-2 gap-1 mb-2">
          <div className="flex justify-between text-[9px] border-b border-white/20 pb-0.5">
            <span className="opacity-50">NRG:</span>
            <span style={{ color: activeColor }}>{Math.round(card.energy * 100)}%</span>
          </div>
          <div className="flex justify-between text-[9px] border-b border-white/20 pb-0.5">
            <span className="opacity-50">VAL:</span>
            <span style={{ color: activeColor }}>{Math.round(card.valence * 100)}%</span>
          </div>
          <div className="flex justify-between text-[9px] border-b border-white/20 pb-0.5">
            <span className="opacity-50">BPM:</span>
            <span style={{ color: activeColor }}>{card.tempo}</span>
          </div>
          <div className="flex justify-between text-[9px] border-b border-white/20 pb-0.5">
            <span className="opacity-50">MOD:</span>
            <span>{card.mood === 'light' ? 'LGT' : 'DRK'}</span>
          </div>
        </div>

        {/* Supply progress */}
        <div className="mt-auto">
          <div className="flex justify-between text-[8px] opacity-40 mb-0.5">
            <span>SUPPLY RECORD</span>
            <span>{card.claimedCount} / {getRarityMaxSupply(card.rarity)}</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 border border-black overflow-hidden">
            <div 
              className="h-full" 
              style={{ 
                width: `${(card.claimedCount / getRarityMaxSupply(card.rarity)) * 100}%`,
                background: activeColor 
              }} 
            />
          </div>
        </div>

        {card.rarity === 'mythic' && (
          <div className="scrolling-metadata-wrapper mt-2">
            <div className="scrolling-metadata-text">
              INITIALIZED // DIGITAL_GRAIL // ID: {card.id.toUpperCase()} // STATUS: AUTHENTICATED
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const backFace = (
    <div className="flex flex-col h-full justify-between p-3 bg-black border-4 border-double" style={{ borderColor: activeColor }}>
      <div className="flex flex-col gap-2">
        <div className="border-b border-white/20 pb-1 text-center">
          <span className="font-mono text-[9px] opacity-50 block">NEURAL CORE LINK</span>
          <span className="font-mono text-xs font-bold" style={{ color: activeColor }}>GEN 0 CARD BACK</span>
        </div>
        <div className="text-[10px] font-mono leading-normal text-white/70">
          <p className="margin-0 mb-2">// DATA ENCRYPTION: SECURE</p>
          <p className="margin-0 mb-2">// SIGNATURE KEY: th3scr1b3.art</p>
          <p className="margin-0">// TIMELINE ORIGIN: GENESIS_RELEASE</p>
        </div>
      </div>
      <div className="border-2 border-dashed p-2 text-center" style={{ borderColor: activeColor }}>
        <span className="font-mono text-[9px] tracking-widest block opacity-70">FLIP TO RETRIEVE</span>
        <span className="font-mono text-[14px] font-black" style={{ color: activeColor }}>#{String(card.day).padStart(3, '0')}</span>
      </div>
    </div>
  );

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="glitch" backSide={backFace}>
      {frontFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 2: GLASS-OUTRUN MINIMALIST
// --------------------------------------------------------------------------
function CardGlass({ card }: { card: VaultCard }) {
  const rarityGlows: Record<Rarity, string> = {
    common: 'rgba(255,255,255,0.15)',
    uncommon: 'rgba(0, 212, 170, 0.35)',
    rare: 'rgba(59, 130, 246, 0.45)',
    legendary: 'rgba(180, 77, 255, 0.55)',
    mythic: 'rgba(255, 215, 0, 0.65)',
  };

  const textGradient = card.rarity === 'mythic' ? 'text-amber-300' : 'text-white';

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

      {/* Top Header */}
      <div className="flex justify-between items-center mb-2 z-10">
        <div className="flex flex-col">
          <span className="text-[8px] text-white/40 tracking-wider font-sans">ARCHIVE ENTRY</span>
          <span className="text-[10px] font-bold font-sans">#00{card.day}</span>
        </div>
        <span className="text-[8px] px-2 py-0.5 rounded-full border bg-black/40 text-white/80" style={{ borderColor: rarityGlows[card.rarity] }}>
          {card.rarity.toUpperCase()}
        </span>
      </div>

      {/* Image box - minimal glass border */}
      <div className="card-image-box h-[52%] rounded-lg border border-white/10 overflow-hidden relative mb-2">
        <img src={card.coverUrl} alt={card.title} className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        
        {/* Subtle hover bloom */}
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse" style={{ background: rarityGlows[card.rarity] }} />
      </div>

      {/* Info drawer */}
      <div className="card-info-box flex flex-col flex-1 z-10 pt-1">
        <h3 className={`text-md font-bold leading-tight tracking-tight mb-1 truncate ${textGradient}`}>
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
    </div>
  );

  const backFace = (
    <div className="flex flex-col h-full justify-between p-4 bg-slate-950/90 border rounded-xl" style={{ borderColor: rarityGlows[card.rarity] }}>
      <div className="text-center mt-2">
        <div className="w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 bg-white/5 border border-white/10">
          <Layers size={16} style={{ color: rarityGlows[card.rarity] }} />
        </div>
        <span className="text-[9px] uppercase tracking-widest text-white/40 block">Iridescent Vault</span>
        <span className="text-xs font-bold text-white uppercase tracking-wider block mt-1">Frosted Node</span>
      </div>
      <div className="text-center text-[7px] text-white/30 font-sans tracking-wide">
        FROSTED GLASS ARCHIVE COMPONENT<br />
        VERIFIED RELEASE CONTRACT #365-WARP
      </div>
    </div>
  );

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="glass" backSide={backFace}>
      {frontFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// DESIGN 3: RETRO-ARCADE 80s
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
        <div className="retro-stripe-bar">
          <div className="retro-stripe-red" />
          <div className="retro-stripe-white" />
        </div>
      )}
      {card.rarity === 'rare' && <div className="diagonal-stripes mb-1" />}

      {/* Header */}
      <div className="flex justify-between items-center mb-1 z-10">
        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tighter">
          DECK: {String(card.day).padStart(3, '0')}
        </span>
        {card.rarity === 'rare' ? (
          <span className="pixel-badge">RARE STEP</span>
        ) : (
          <span className="text-[8px] bg-black px-1.5 py-0.5 border border-white/20 rounded">
            {card.rarity.toUpperCase()}
          </span>
        )}
      </div>

      {/* Art Screen */}
      <div className="card-image-box h-[42%] border-4 border-slate-800 relative z-10">
        <img src={card.coverUrl} alt={card.title} className="w-full h-full object-cover filter contrast-125 saturate-150" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121214] via-transparent to-transparent" />
      </div>

      {/* Synth Dials & Stats */}
      <div className="card-info-box flex flex-col flex-1 z-10 pt-1.5 font-mono">
        <h3 className="text-xs font-black uppercase text-white tracking-wide truncate mb-1 text-shadow-retro">
          {card.title}
        </h3>

        {/* Synthesizer Knobs */}
        {card.rarity === 'uncommon' && (
          <div className="knobs-container mb-2">
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
        <div className="bg-black/60 p-1 border border-white/10 rounded mb-1 text-[8px]">
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
    </div>
  );

  const backFace = (
    <div className="flex flex-col h-full justify-between p-3 bg-[#0d0d0f] border-4" style={{ borderColor: outlineColor }}>
      <div className="flex justify-between items-center border-b border-white/20 pb-1">
        <span className="text-[8px] text-amber-500 font-bold font-mono">ROLAND MODE</span>
        <span className="text-[8px] font-mono">TR-808 COMPAT</span>
      </div>
      <div className="flex flex-col items-center gap-1 my-auto">
        <span className="text-[28px] leading-none">🕹️</span>
        <span className="text-[9px] font-mono uppercase font-black tracking-widest text-white">INSERT COIN</span>
        <span className="text-[7px] font-mono text-white/40 uppercase">TO LAUNCH SEQUENCE</span>
      </div>
      <div className="h-2 w-full flex">
        {stripeColors[card.rarity].map((col, idx) => (
          <div key={idx} className="flex-1" style={{ background: col }} />
        ))}
      </div>
    </div>
  );

  return (
    <Card3DWrapper rarity={card.rarity} themeClass="arcade" backSide={backFace}>
      {frontFace}
    </Card3DWrapper>
  );
}

// --------------------------------------------------------------------------
// MAIN SHOWCASE PAGE COMPONENT
// --------------------------------------------------------------------------
export default function CardDesignShowcase() {
  const [activeTab, setActiveTab] = useState<'compare' | 'glitch' | 'glass' | 'arcade'>('compare');

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
            <p className="showcase-subtitle">Interactive showcase comparing three cyberpunk design styles across all rarity levels</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ff3800]/10 border border-[#ff3800]/30 rounded">
            <RotateCcw size={14} className="text-[#ff3800] animate-spin" style={{ animationDuration: '6s' }} />
            <span className="text-[10px] text-[#ff3800] font-black uppercase tracking-wider">Lab Workspace Active</span>
          </div>
        </div>

        {/* Interactive selectors */}
        <div className="controls-row">
          <div className="control-group">
            <span className="control-label">Select Workspace View:</span>
            <button 
              className={`btn-tab ${activeTab === 'compare' ? 'active' : ''}`}
              onClick={() => setActiveTab('compare')}
            >
              Side-by-side (All Themes)
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
              Frosted Glassmorphism
            </button>
            <button 
              className={`btn-tab ${activeTab === 'arcade' ? 'active' : ''}`}
              onClick={() => setActiveTab('arcade')}
            >
              Retro-Arcade 80s
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
              High contrast industrial digital layout featuring raw borders, stencils, scanlines, hazard strips and hover glitches.
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
              Sleek frosted-glass paneling using backdrop-filter blur, cobalt/amethyst colors, spinning light meshes, and gold borders.
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
              Vintage Roland TR-808 synthesizer board aesthetic with yellow grids, retro knobs, dual racing stripes, and Outrun vector perspective grids.
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
        </div>
      ) : (
        <div>
          <h2 className="section-title border-b border-white/10 pb-2">
            {activeTab === 'glitch' && 'Concept 1: Neon-Brutalist Glitch'}
            {activeTab === 'glass' && 'Concept 2: Glass-Outrun Minimalist'}
            {activeTab === 'arcade' && 'Concept 3: Retro-Arcade 80s'}
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
