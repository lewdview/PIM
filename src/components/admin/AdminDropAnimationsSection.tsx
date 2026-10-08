import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Zap,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Layers,
  Flame,
  Award,
  Terminal,
  Radio,
  FileCode,
  CheckCircle,
  ExternalLink,
  Info,
  Gift,
  ShieldAlert,
} from 'lucide-react';
import { audioManager } from '../../game/audio';
import { haptics } from '../../utils/haptics';
import {
  RARITY_CONFIG,
  PACK_CONFIGS,
  ROLL_RATES,
  type Rarity,
  type PackCategory,
  type PackSize,
} from '../../utils/rarity';
import { useVaultStore, type RevealPackMeta } from '../../store/useVaultStore';
import type { OwnedCard, VaultCard } from '../../services/vaultService';
import { STORAGE_BASE } from '../../services/supabaseClient';

// Core Drop Animation Components
import PackContainer from '../cinematic/PackContainer';
import PackRipAnimation from '../PackRipAnimation';
import DecryptionAnimation from '../DecryptionAnimation';
import UltraRewardModal from '../UltraRewardModal';
import Card from '../Card';
import RarityBadge from '../RarityBadge';

// ===== MOCK VAULT CARDS FOR DROP PREVIEWS =====
const MOCK_CARDS_BY_RARITY: Record<Rarity, VaultCard> = {
  common: {
    id: 'mock-drop-common',
    day: 3,
    title: 'You Like Steve Earle',
    storageTitle: 'You Like Steve Earle',
    mood: 'dark',
    rarity: 'common',
    energy: 0.418,
    valence: 0.468,
    tempo: 108,
    genre: ['Alternative', 'Indie'],
    tags: ['reflective', 'hopeful'],
    coverUrl: `${STORAGE_BASE}covers/january/03%20-%20You%20Like%20Steve%20Earle.jpg`,
    audioUrl: '',
    description: 'Exploring relationship dynamics and search for clarity.',
    claimedCount: 242,
    maxSupply: 1000,
  },
  uncommon: {
    id: 'mock-drop-uncommon',
    day: 1,
    title: "We're Going Crazy World",
    storageTitle: 'Were Going Crazy World',
    mood: 'dark',
    rarity: 'uncommon',
    energy: 0.443,
    valence: 0.406,
    tempo: 161,
    genre: ['Alternative', 'Indie'],
    tags: ['chaotic', 'hazy'],
    coverUrl: `${STORAGE_BASE}covers/january/01%20-%20Were%20Going%20Crazy%20World.jpg`,
    audioUrl: '',
    description: 'Exploring mental health and self-discovery in the digital age.',
    claimedCount: 145,
    maxSupply: 500,
  },
  rare: {
    id: 'mock-drop-rare',
    day: 13,
    title: 'Dashboard of Life',
    storageTitle: 'Dashboard of Life',
    mood: 'dark',
    rarity: 'rare',
    energy: 0.477,
    valence: 0.521,
    tempo: 99,
    genre: ['Alternative', 'Indie'],
    tags: ['reflective', 'introspective'],
    coverUrl: `${STORAGE_BASE}covers/january/13%20-%20Dashboard%20of%20Life.jpg`,
    audioUrl: '',
    description: 'Exploring personal growth and high-tempo self-reflection.',
    claimedCount: 22,
    maxSupply: 50,
  },
  legendary: {
    id: 'mock-drop-legendary',
    day: 42,
    title: 'Prophecy of the Warp',
    storageTitle: 'Prophecy of the Warp',
    mood: 'light',
    rarity: 'legendary',
    energy: 0.85,
    valence: 0.72,
    tempo: 128,
    genre: ['Outrun', 'Synthwave'],
    tags: ['cyberpunk', 'intense'],
    coverUrl: `${STORAGE_BASE}covers/january/14%20-%20Undercoa%204.jpg`,
    audioUrl: '',
    description: 'A legendary descent into the digital grid and neon audio streams.',
    claimedCount: 3,
    maxSupply: 5,
  },
  mythic: {
    id: 'mock-drop-mythic',
    day: 100,
    title: 'Afterlife (Special 1/1)',
    storageTitle: 'Afterlife Title Track',
    mood: 'light',
    rarity: 'mythic',
    energy: 0.95,
    valence: 0.88,
    tempo: 140,
    genre: ['Future Bass', 'Trap'],
    tags: ['1 of 1', 'supernova', 'celestial'],
    coverUrl: `${STORAGE_BASE}covers/january/100%20-%20Afterlife.jpg`,
    audioUrl: '',
    description: 'Celestial one-of-a-kind Mythic artifact forged at the boundary of reality.',
    claimedCount: 1,
    maxSupply: 1,
  },
};

const MOCK_BOMBSHELL_CARD: VaultCard = {
  id: 'mock-drop-bombshell',
  day: 69,
  title: 'Panik Neon Bombshell',
  storageTitle: 'Panik Neon Bombshell',
  mood: 'dark',
  rarity: 'legendary',
  energy: 0.92,
  valence: 0.81,
  tempo: 135,
  genre: ['Cyberpunk', 'J-Rock'],
  tags: ['bombshell', 'graffiti', 'panik'],
  cardSet: 'bombshell',
  coverUrl: '/data/packs/bs_cover.png',
  audioUrl: '',
  description: 'Limited edition anime graffiti collectible from the Panik collection.',
  claimedCount: 12,
  maxSupply: 25,
};

// ===== ANIMATION DEFINITIONS METADATA =====
export interface DropAnimationMeta {
  id: string;
  name: string;
  tagline: string;
  category: 'pack' | 'card' | 'cipher' | 'gameplay' | 'forge' | 'special';
  badge: string;
  badgeColor: string;
  triggerLocation: string;
  audioStems: string[];
  techStack: string[];
  description: string;
  sourceFile: string;
}

export const DROP_ANIMATION_CATALOG: DropAnimationMeta[] = [
  {
    id: 'cinematic_pack',
    name: 'Cinematic 3D Booster Rip',
    tagline: 'Multi-phase physical pack rip with crinkle audio, flash & card rise',
    category: 'pack',
    badge: 'FLAGSHIP GACHA',
    badgeColor: '#ff007f',
    triggerLocation: 'Pack Shop, Targeted Pull, Token Store, Large Bundle Buys',
    audioStems: ['ambient', 'crinkle', 'tension', 'tear', 'snap', 'shimmer', 'near_miss'],
    techStack: ['Framer Motion Springs', '3D CSS Transforms', 'Web Audio Synthesizer', 'Dynamic Specular Sheen'],
    description:
      'The premier physical opening experience. Features 9 sequential physics phases: floating idle, tactile grip hold, pre-tear tension stretch, glowing fiber seam tearing, high-intensity tear snap with screen flash & zoom pulse, 3D card rise from envelope, individual card flip with near-miss fakeouts, and arc spread examination.',
    sourceFile: 'src/components/cinematic/PackContainer.tsx',
  },
  {
    id: 'arcade_pack_rip',
    name: 'Arcade Fast Tap-to-Rip',
    tagline: 'Rapid high-speed split halves flying apart with rotational velocity',
    category: 'pack',
    badge: 'ARCADE ACTION',
    badgeColor: '#00e5ff',
    triggerLocation: 'Daily Claim, Tutorial Completion, Quick Pack Rips',
    audioStems: ['open_chest', 'tap_nav'],
    techStack: ['CSS Polygon Clip-Path', 'Framer Motion Keyframes', 'Dynamic Halves Split'],
    description:
      'High-energy arcade rip tailored for fast-paced reward claiming. On tap, the pack wrapper shakes violently before splitting cleanly along an angled polygon seam into top and bottom halves that shoot away in opposite directions (-220px / +220px) with rotational spin, ending in a pure whiteout flash.',
    sourceFile: 'src/components/PackRipAnimation.tsx',
  },
  {
    id: 'decryption_cipher',
    name: 'Cipher Decryption Matrix Burst',
    tagline: 'Terminal matrix scanner with 80+ Canvas 2D physics crystal shards',
    category: 'cipher',
    badge: 'SECRET CIPHER',
    badgeColor: '#39ff14',
    triggerLocation: 'Bonus Code Redeem, Secret Transmission Ciphers, Warp Terminals',
    audioStems: ['open_chest', 'tap_perfect', 'reveal'],
    techStack: ['HTML5 Canvas 2D', 'Kinetic Shard Physics (Gravity/Drag/Spin)', 'Matrix CRT Scanline'],
    description:
      'Cyberpunk terminal unlock sequence. Shows an encrypted data core box with real-time green matrix text scanning. Once breached, it fires an 80-particle 2D canvas explosion of glowing neon polygonal shards (triangles, diamonds, pentagons) that burst outward under gravity, air drag, and rotational spin.',
    sourceFile: 'src/components/DecryptionAnimation.tsx',
  },
  {
    id: 'mythic_supernova',
    name: 'Mythic 1-of-1 Supernova Blast',
    tagline: 'Shockwave blast, golden particle corona & celestial banner',
    category: 'card',
    badge: '1 OF 1 CELESTIAL',
    badgeColor: '#ffd700',
    triggerLocation: 'Mythic Card Reveal (3% or 1/1 Unique Pulls)',
    audioStems: ['queue_before_mythic', 'mythic_get'],
    techStack: ['Radial Supernova Gradient', 'Prism Foil Shaders', 'Continuous Spinning Stars'],
    description:
      'The rarest drop in the entire ecosystem. Triggered exclusively when revealing a Mythic 1/1 card. Creates a massive expanding supernova ring (0.2x to 3.8x scale), golden corona blast, dual counter-spinning ✦ stars, and an elevated "MYTHIC 1 OF 1 DISCOVERED!" gilded banner with glowing drop-shadow.',
    sourceFile: 'src/pages/PackRevealPage.tsx (Lines 464-489)',
  },
  {
    id: 'legendary_radiant',
    name: 'Legendary Radiant Glow',
    tagline: 'Pulsing violet aura & radial light cone expansion',
    category: 'card',
    badge: 'LEGENDARY TIER',
    badgeColor: '#c44dff',
    triggerLocation: 'Legendary Card Reveal in Pack Reveal Flow',
    audioStems: ['gold_get', 'reveal'],
    techStack: ['Framer Motion Scale Interpolation', 'Multi-stop Radial Gradients'],
    description:
      'High-tier pull celebration. An intense radial violet/fuchsia light cone pulses outward from the center of the card, expanding through scale keyframes [0.5, 2, 3] while fading out smoothly to signify high-value rarity discovery.',
    sourceFile: 'src/pages/PackRevealPage.tsx (Lines 489-500)',
  },
  {
    id: 'ultra_vinyl_reward',
    name: 'Ultra Reward 1/1 Physical Vinyl',
    tagline: 'Golden foil sweep, diamond grid & real-world 7" vinyl claim modal',
    category: 'special',
    badge: 'PHYSICAL 7" VINYL',
    badgeColor: '#ffb800',
    triggerLocation: 'Fresh Pull of Card with ultraReward: true (Day 365 / Milestone)',
    audioStems: ['bing_before_platinum', 'gold_get'],
    techStack: ['Animated SVG Diamond Grid', 'Foil Sweep CSS Shaders', 'Backdrop Blur Filter'],
    description:
      'Special physical prize drop notification. When a user unpacks an Ultra Reward card, this luxury modal intercepts with an animated gold foil sweep, pulsing ambient radial backlight, 1/1 vinyl icon showcase, and direct one-click routing to the physical claim desk.',
    sourceFile: 'src/components/UltraRewardModal.tsx',
  },
  {
    id: 'stage_clear_drop',
    name: 'Arcade Stage Clear & Medal Drop',
    tagline: 'Dot-matrix marquee ticker, medal fanfare & unlocked tier pack drop',
    category: 'gameplay',
    badge: 'RHYTHM VICTORY',
    badgeColor: '#00ffff',
    triggerLocation: 'Song Finish / Results Screen (Platinum, Gold, Silver, Bronze)',
    audioStems: ['platinum_get', 'gold_get', 'silver_get', 'bronze_get', 'song_completion'],
    techStack: ['LED Dot-Matrix Overlay', 'Circular SVG Accuracy Dial', 'Infinite CSS Marquee'],
    description:
      'The rhythmic celebration sequence shown upon finishing a song. Features a real-time retro arcade LED ticker scrolling congratulatory signals, an animated circular accuracy gauge that chimes at medal thresholds, and an interactive reward tier drop beacon ready to claim.',
    sourceFile: 'src/pages/GameResults.tsx (ArcadeMarquee & Tier Claim)',
  },
  {
    id: 'forge_fusion',
    name: 'Forge Ascension & Fusion Spark',
    tagline: '3-card duplicate collision, flame burn & rarity upgrade ignition',
    category: 'forge',
    badge: 'FORGE CRAFT',
    badgeColor: '#ff3800',
    triggerLocation: 'Forge Page (Duplicate Fusion & Rarity Upgrade)',
    audioStems: ['fusion', 'case_open_2', 'open_chest'],
    techStack: ['Flame Particle Burst', 'Scale Convergence Keyframes', 'Dynamic Tier Transformation'],
    description:
      'The tokenomic crafting animation. Three identical duplicate cards converge toward a central magnetic point, igniting a fiery forge burn that fuses them into a pristine higher-rarity card with sound design and haptic tap bursts.',
    sourceFile: 'src/pages/ForgePage.tsx & src/services/vaultService.ts',
  },
  {
    id: 'daily_beacon_scanner',
    name: 'Daily Drop Radar Scanner',
    tagline: 'Sci-fi frequency beacon & calendar drop stage calibration HUD',
    category: 'special',
    badge: 'CALIBRATION HUD',
    badgeColor: '#a78bfa',
    triggerLocation: '/daily & /daily-drop Route Transitions',
    audioStems: ['tap_nav', 'powerup_t1'],
    techStack: ['Neon Pulse Keyframes', 'Radar Sweep Line', 'Monospace Telemetry Feed'],
    description:
      'Sci-fi radar beacon that locks onto the current day of the year in the 365-day archive. Displays real-time scanning radar telemetry and frequency lock before launching into the daily stage or drop reveal.',
    sourceFile: 'src/App.tsx (DailyDropRoute Handler)',
  },
  {
    id: 'genesis_proof_stamp',
    name: 'Genesis Proof-of-First (1/1) Stamp',
    tagline: 'Holographic proof badge pop-in for the very first discoverer',
    category: 'card',
    badge: 'PROVENANCE STAMP',
    badgeColor: '#a78bfa',
    triggerLocation: 'Fresh Pull of Unminted #1 Card or First Listen',
    audioStems: ['diamond', 'tap_perfect'],
    techStack: ['Framer Motion Spring Pop', 'Holographic Gradient Border'],
    description:
      'Immutable provenance pop-in. If the user is the first player on Base mainnet to uncover a card, this holographic purple/red "🔮 PROOF OF FIRST (1/1)" badge bounces in with a spring pop, certifying priority on the blockchain.',
    sourceFile: 'src/pages/PackRevealPage.tsx (Lines 513-532)',
  },
];

export default function AdminDropAnimationsSection() {
  const packDesignStyle = useVaultStore((s) => s.packDesignStyle);
  const setPackDesignStyle = useVaultStore((s) => s.setPackDesignStyle);

  // Active view mode: 'catalog' | 'stage' | 'gacha_sim'
  const [viewMode, setViewMode] = useState<'catalog' | 'stage' | 'gacha_sim'>('catalog');

  // Active drop animation under test
  const [selectedAnimationId, setSelectedAnimationId] = useState<string>('cinematic_pack');

  // Animation configuration controls
  const [selectedRarity, setSelectedRarity] = useState<Rarity>('legendary');
  const [selectedPackCategory, setSelectedPackCategory] = useState<PackCategory>('bombshell');
  const [selectedCardCount, setSelectedCardCount] = useState<number>(3);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isUltraActive, setIsUltraActive] = useState<boolean>(false);
  const [isProofOfFirstActive, setIsProofOfFirstActive] = useState<boolean>(true);

  // Active Live Stage Trigger States
  const [activeStageRunning, setActiveStageRunning] = useState<boolean>(false);
  const [stageKey, setStageKey] = useState<number>(1);

  // Custom modal triggers
  const [showUltraModal, setShowUltraModal] = useState<boolean>(false);
  const [showDecryptionModal, setShowDecryptionModal] = useState<boolean>(false);

  // Generate mock cards payload based on configuration
  const mockCardsPayload = useMemo<OwnedCard[]>(() => {
    const baseCard =
      selectedPackCategory === 'bombshell' || selectedPackCategory === 'bombshell_token'
        ? MOCK_BOMBSHELL_CARD
        : MOCK_CARDS_BY_RARITY[selectedRarity] || MOCK_CARDS_BY_RARITY.rare;

    const cards: OwnedCard[] = [];
    for (let i = 0; i < selectedCardCount; i++) {
      // First card matches selected rarity, remaining cards vary for realistic pack feel
      let cardRarity: Rarity = selectedRarity;
      if (i === 1) cardRarity = 'uncommon';
      if (i === 2) cardRarity = 'common';
      if (i >= 3) cardRarity = i % 2 === 0 ? 'rare' : 'common';

      const cardData = {
        ...(MOCK_CARDS_BY_RARITY[cardRarity] || baseCard),
        rarity: i === 0 ? selectedRarity : cardRarity,
      };

      cards.push({
        id: `mock-owned-${i + 1}-${Date.now()}`,
        cardId: cardData.id,
        owner: '0xADMIN_TESTER',
        rarity: cardData.rarity,
        edition: i === 0 && isProofOfFirstActive ? 1 : i + 1,
        acquiredAt: new Date().toISOString(),
        source: 'pack_purchase',
        card: cardData,
        proof: i === 0 && isProofOfFirstActive ? 'proof_of_first' : undefined,
        ultraReward: i === 0 && isUltraActive,
        isEcho: i === 2,
        echoGeneration: i === 2 ? 1 : undefined,
      });
    }
    return cards;
  }, [selectedRarity, selectedPackCategory, selectedCardCount, isUltraActive, isProofOfFirstActive]);

  // Generate RevealPackMeta based on configuration
  const mockPackMeta = useMemo<RevealPackMeta>(() => {
    const isBombshell =
      selectedPackCategory === 'bombshell' || selectedPackCategory === 'bombshell_token';
    const cfg = PACK_CONFIGS[selectedPackCategory] || {
      category: selectedPackCategory,
      label: isBombshell ? 'BOMBSHELL PANIK PACK' : 'VAULT BOOSTER PACK',
      description: 'Exclusive anime & archive cards',
      icon: isBombshell ? '💖' : '⚡',
      accent: isBombshell ? '#FF1493' : '#00E5FF',
      gradient: isBombshell
        ? 'linear-gradient(160deg, #300a1e 0%, #501234 40%, #200816 100%)'
        : 'linear-gradient(160deg, #0a1020 0%, #152540 40%, #081018 100%)',
    };

    return {
      category: selectedPackCategory,
      size: (selectedCardCount === 1 ? 'single' : selectedCardCount === 3 ? 'trio' : 'booster') as PackSize,
      label: cfg.label || (isBombshell ? 'BOMBSHELL PACK' : 'VAULT PACK'),
      icon: cfg.icon || (isBombshell ? '💖' : '⚡'),
      accent: cfg.accent || (isBombshell ? '#FF1493' : '#00E5FF'),
      gradient:
        cfg.gradient ||
        (isBombshell
          ? 'linear-gradient(160deg, #300a1e 0%, #501234 40%, #200816 100%)'
          : 'linear-gradient(160deg, #0a1020 0%, #152540 40%, #081018 100%)'),
      price: '$0.25',
      cardCount: selectedCardCount,
      revealType: selectedAnimationId === 'arcade_pack_rip' ? 'tap' : 'cinematic',
      coverImage: isBombshell ? '/data/packs/bs_cover.png' : undefined,
      showRipAnother: true,
    };
  }, [selectedPackCategory, selectedCardCount, selectedAnimationId]);

  // Audio helper
  const playTestSfx = useCallback(
    (name: any) => {
      if (!soundEnabled) return;
      try {
        audioManager.playSfx(name, 0.85);
      } catch (e) {
        console.warn('Audio test failed:', e);
      }
    },
    [soundEnabled]
  );

  // Trigger test for specific animation
  const triggerAnimationTest = useCallback(
    (animId: string) => {
      setSelectedAnimationId(animId);
      if (soundEnabled) {
        haptics.lightTap();
      }

      if (animId === 'ultra_vinyl_reward') {
        playTestSfx('bing_before_platinum');
        setShowUltraModal(true);
        return;
      }

      if (animId === 'decryption_cipher') {
        playTestSfx('open_chest');
        setShowDecryptionModal(true);
        return;
      }

      if (animId === 'mythic_supernova') {
        setSelectedRarity('mythic');
        playTestSfx('queue_before_mythic');
      } else if (animId === 'legendary_radiant') {
        setSelectedRarity('legendary');
        playTestSfx('gold_get');
      } else if (animId === 'forge_fusion') {
        playTestSfx('fusion');
      }

      // Switch to live stage view and reboot animation
      setStageKey((k) => k + 1);
      setActiveStageRunning(true);
      setViewMode('stage');
    },
    [playTestSfx, soundEnabled]
  );

  // RNG Gacha Roll Simulator
  const [gachaRollResult, setGachaRollResult] = useState<{
    rolledRarity: Rarity;
    packType: string;
    timestamp: string;
  } | null>(null);

  const handleSimulateGachaRoll = useCallback(() => {
    const rates = ROLL_RATES[selectedPackCategory] || [60, 25, 12, 3];
    const roll = Math.random() * 100;

    let rolled: Rarity = 'common';
    let cumulative = 0;

    // Check mythic (if 5-tier or using 3% rule)
    if (rates.length >= 5) {
      const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
      for (let i = 0; i < rates.length; i++) {
        cumulative += rates[i];
        if (roll <= cumulative) {
          rolled = rarities[i];
          break;
        }
      }
    } else {
      // 4-tier: common, uncommon, rare, legendary, with 3% mythic override
      if (roll <= rates[0]) rolled = 'common';
      else if (roll <= rates[0] + rates[1]) rolled = 'uncommon';
      else if (roll <= rates[0] + rates[1] + rates[2]) rolled = 'rare';
      else rolled = Math.random() < 0.25 ? 'mythic' : 'legendary';
    }

    setSelectedRarity(rolled);
    setGachaRollResult({
      rolledRarity: rolled,
      packType: selectedPackCategory,
      timestamp: new Date().toLocaleTimeString(),
    });

    if (soundEnabled) {
      if (rolled === 'mythic') audioManager.playSfx('queue_before_mythic', 0.9);
      else if (rolled === 'legendary') audioManager.playSfx('gold_get', 0.9);
      else audioManager.playSfx('open_chest', 0.8);
    }

    setStageKey((k) => k + 1);
    setActiveStageRunning(true);
    setViewMode('stage');
  }, [selectedPackCategory, soundEnabled]);

  const selectedMeta = useMemo(() => {
    return DROP_ANIMATION_CATALOG.find((a) => a.id === selectedAnimationId) || DROP_ANIMATION_CATALOG[0];
  }, [selectedAnimationId]);

  return (
    <div className="space-y-8">
      {/* ===== HERO CONTROL ROOM BANNER ===== */}
      <div
        className="p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 10, 25, 0.95) 0%, rgba(10, 8, 18, 0.98) 100%)',
          border: '1px solid rgba(255, 0, 127, 0.3)',
          boxShadow: '0 0 30px rgba(255, 0, 127, 0.1), 6px 6px 0 #000',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2.5 py-0.5 text-[9px] font-mono font-bold tracking-widest uppercase bg-[#ff007f]/20 border border-[#ff007f]/40 text-[#ff007f]">
                NEURAL REVEAL LAB // PIM v2.1
              </span>
              <span className="text-zinc-500 font-mono text-[9px]">10 TOTAL DROP SEQUENCES</span>
            </div>
            <h1
              className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white"
              style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                letterSpacing: '-0.02em',
                textShadow: '0 0 20px rgba(255, 0, 127, 0.4)',
              }}
            >
              DROP ANIMATIONS LAB
            </h1>
            <p className="text-xs font-mono text-zinc-400 mt-1 max-w-2xl leading-relaxed">
              Interactive workbench to stress-test, benchmark, and preview all 10 loot drops, pack ripping
              physics, crystal shard particle systems, and provenance animations.
            </p>
          </div>

          {/* Quick Sub-navigation / View Mode */}
          <div className="flex items-center gap-2 bg-black/60 p-1.5 border border-white/10 self-start md:self-auto">
            <button
              onClick={() => {
                setActiveStageRunning(false);
                setViewMode('catalog');
              }}
              className={`px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'catalog'
                  ? 'bg-[#ff007f] text-black shadow-[2px_2px_0_#000]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              📚 GALLERY GRID
            </button>
            <button
              onClick={() => {
                setStageKey((k) => k + 1);
                setActiveStageRunning(true);
                setViewMode('stage');
              }}
              className={`px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'stage'
                  ? 'bg-[#00e5ff] text-black shadow-[2px_2px_0_#000]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🎬 LIVE STAGE
            </button>
            <button
              onClick={() => setViewMode('gacha_sim')}
              className={`px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'gacha_sim'
                  ? 'bg-[#ffd700] text-black shadow-[2px_2px_0_#000]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🎲 GACHA RNG ROLLER
            </button>
          </div>
        </div>

        {/* Global Configuration Tuning Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs font-mono">
          {/* Pack Design Style */}
          <div className="space-y-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block">PACK SKIN</span>
            <div className="flex bg-black/50 border border-white/15 rounded p-0.5">
              <button
                onClick={() => setPackDesignStyle('classic_foil')}
                className={`flex-1 py-1 text-[9px] uppercase font-bold transition-all cursor-pointer ${
                  packDesignStyle === 'classic_foil'
                    ? 'bg-amber-400 text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                FOIL
              </button>
              <button
                onClick={() => setPackDesignStyle('cyber_cartridge')}
                className={`flex-1 py-1 text-[9px] uppercase font-bold transition-all cursor-pointer ${
                  packDesignStyle === 'cyber_cartridge'
                    ? 'bg-cyan-400 text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                CYBER
              </button>
            </div>
          </div>

          {/* Rarity */}
          <div className="space-y-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block">RARITY PAYLOAD</span>
            <select
              value={selectedRarity}
              onChange={(e) => setSelectedRarity(e.target.value as Rarity)}
              className="w-full bg-black/60 border border-white/20 text-white text-[10px] py-1.5 px-2 rounded font-mono outline-none cursor-pointer"
            >
              <option value="common">Common (60%)</option>
              <option value="uncommon">Uncommon (25%)</option>
              <option value="rare">Rare (12%)</option>
              <option value="legendary">Legendary (3%)</option>
              <option value="mythic">Mythic (1/1 ✦)</option>
            </select>
          </div>

          {/* Pack Category */}
          <div className="space-y-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block">THEME / PACK</span>
            <select
              value={selectedPackCategory}
              onChange={(e) => setSelectedPackCategory(e.target.value as PackCategory)}
              className="w-full bg-black/60 border border-white/20 text-white text-[10px] py-1.5 px-2 rounded font-mono outline-none cursor-pointer"
            >
              <option value="bombshell">💖 Bombshell Panik</option>
              <option value="taste">⚡ Taste Pack</option>
              <option value="light">☀️ Light Theme</option>
              <option value="dark">🌑 Dark Theme</option>
              <option value="month">📅 Month Archive</option>
              <option value="alpha">💎 Alpha Pack</option>
              <option value="prophecy">🔮 Prophecy 1/1</option>
            </select>
          </div>

          {/* Card Count */}
          <div className="space-y-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block">CARD COUNT</span>
            <div className="flex bg-black/50 border border-white/15 rounded p-0.5">
              {[1, 3, 5, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => setSelectedCardCount(num)}
                  className={`flex-1 py-1 text-[9px] font-bold transition-all cursor-pointer ${
                    selectedCardCount === num
                      ? 'bg-white text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {num}×
                </button>
              ))}
            </div>
          </div>

          {/* Sound Mute */}
          <div className="space-y-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block">SPATIAL AUDIO</span>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-full py-1.5 px-3 flex items-center justify-center gap-2 border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
              {soundEnabled ? 'SFX ON' : 'MUTED'}
            </button>
          </div>

          {/* 1/1 Modifiers */}
          <div className="space-y-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block">SPECIAL MODS</span>
            <div className="flex gap-1">
              <button
                onClick={() => setIsProofOfFirstActive(!isProofOfFirstActive)}
                className={`flex-1 py-1.5 text-[8px] font-bold uppercase border transition-all cursor-pointer ${
                  isProofOfFirstActive
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                    : 'bg-black/40 border-white/10 text-zinc-500'
                }`}
                title="Toggle Proof of First badge on first card"
              >
                1/1 PROOF
              </button>
              <button
                onClick={() => setIsUltraActive(!isUltraActive)}
                className={`flex-1 py-1.5 text-[8px] font-bold uppercase border transition-all cursor-pointer ${
                  isUltraActive
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-black/40 border-white/10 text-zinc-500'
                }`}
                title="Toggle Ultra Reward physical vinyl flag"
              >
                VINYL 7"
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== VIEW MODE 1: INTERACTIVE LIVE STAGE ===== */}
      {viewMode === 'stage' && (
        <div
          className="p-6 relative border border-white/15 bg-black/90 space-y-6"
          style={{ boxShadow: '8px 8px 0 #000' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full animate-ping"
                style={{ background: selectedMeta.badgeColor }}
              />
              <div>
                <span
                  className="text-[9px] font-mono uppercase font-bold tracking-widest px-2 py-0.5 rounded"
                  style={{
                    background: `${selectedMeta.badgeColor}20`,
                    color: selectedMeta.badgeColor,
                    border: `1px solid ${selectedMeta.badgeColor}40`,
                  }}
                >
                  {selectedMeta.badge}
                </span>
                <h2 className="text-xl font-black uppercase text-white mt-1">
                  {selectedMeta.name}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStageKey((k) => k + 1)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs uppercase font-bold tracking-wider flex items-center gap-2 border border-white/15 transition-all cursor-pointer"
              >
                <RotateCcw size={13} /> RESTART ANIMATION
              </button>
              <button
                onClick={() => setViewMode('catalog')}
                className="px-4 py-2 bg-transparent text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider border border-white/10 cursor-pointer"
              >
                ← BACK TO GALLERY
              </button>
            </div>
          </div>

          {/* LIVE STAGE CONTAINER */}
          <div
            className="w-full relative min-h-[580px] rounded-xl flex items-center justify-center overflow-hidden border border-white/10"
            style={{
              background: 'radial-gradient(circle at 50% 50%, #0a0614 0%, #040207 100%)',
            }}
          >
            {/* Ambient Background Grid */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />

            {/* Stage Renderer Branching based on Animation ID */}
            {selectedAnimationId === 'cinematic_pack' && (
              <div className="w-full h-full relative" style={{ minHeight: '580px' }}>
                <PackContainer
                  key={`stage-cine-${stageKey}`}
                  meta={mockPackMeta}
                  cards={mockCardsPayload}
                  accumulatedCards={mockCardsPayload}
                  onComplete={() => {
                    playTestSfx('song_completion');
                    alert('Cinematic reveal sequence completed!');
                  }}
                  onBuyAnother={() => setStageKey((k) => k + 1)}
                  onCastPull={() => alert('Cast Pull triggered!')}
                  onSharePull={() => alert('Share Pull link copied!')}
                />
              </div>
            )}

            {selectedAnimationId === 'arcade_pack_rip' && (
              <div className="w-full h-full relative" style={{ minHeight: '520px' }}>
                <PackRipAnimation
                  key={`stage-tap-${stageKey}`}
                  meta={{ ...mockPackMeta, revealType: 'tap' }}
                  onComplete={() => {
                    playTestSfx('reveal');
                    alert('Arcade rip complete! Transitioning into cards.');
                  }}
                />
              </div>
            )}

            {selectedAnimationId === 'mythic_supernova' && (
              <div className="py-12 flex flex-col items-center justify-center relative z-20 space-y-6">
                <span className="text-amber-400 font-mono text-[10px] tracking-widest uppercase font-bold px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full animate-pulse">
                  ✦ CELESTIAL SUPERNOVA SIMULATION ACTIVE ✦
                </span>
                <div className="relative w-[260px] md:w-[290px]">
                  <Card
                    card={MOCK_CARDS_BY_RARITY.mythic}
                    edition={1}
                    interactive={true}
                    showAudio={true}
                    proof="proof_of_first"
                  />
                  {/* Mythic Supernova Blast Overlay */}
                  <motion.div
                    key={`supernova-${stageKey}`}
                    initial={{ opacity: 0, scale: 0.2 }}
                    animate={{ opacity: [0, 1, 0], scale: [0.2, 2.5, 3.8] }}
                    transition={{ duration: 1.4, ease: 'easeOut' }}
                    className="absolute -inset-10 rounded-full pointer-events-none z-40"
                    style={{
                      background:
                        'radial-gradient(circle, #ffffff 0%, #ffd700 45%, rgba(255,0,127,0.3) 70%, transparent 90%)',
                    }}
                  />
                  <motion.div
                    key={`banner-${stageKey}`}
                    initial={{ scale: 0.6, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, type: 'spring' }}
                    className="absolute -top-12 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-xl bg-black/90 border border-[#ffd700] shadow-[0_0_25px_rgba(255,215,0,0.8)] flex items-center gap-2 whitespace-nowrap z-50 pointer-events-none"
                  >
                    <span className="text-xs text-[#ffd700] animate-spin">✦</span>
                    <span className="font-mono text-[11px] font-black text-[#ffd700] tracking-widest uppercase">
                      MYTHIC 1 OF 1 DISCOVERED!
                    </span>
                    <span
                      className="text-xs text-[#ffd700] animate-spin"
                      style={{ animationDirection: 'reverse' }}
                    >
                      ✦
                    </span>
                  </motion.div>
                </div>
                <button
                  onClick={() => {
                    playTestSfx('queue_before_mythic');
                    setStageKey((k) => k + 1);
                  }}
                  className="px-6 py-2.5 bg-[#ffd700] text-black font-black font-mono text-xs uppercase tracking-wider shadow-[3px_3px_0_#000] cursor-pointer"
                >
                  ⚡ RE-TRIGGER SUPERNOVA BLAST
                </button>
              </div>
            )}

            {selectedAnimationId === 'legendary_radiant' && (
              <div className="py-12 flex flex-col items-center justify-center relative z-20 space-y-6">
                <span className="text-purple-400 font-mono text-[10px] tracking-widest uppercase font-bold px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full">
                  ★ RADIANT AURA BURST SIMULATION
                </span>
                <div className="relative w-[260px] md:w-[290px]">
                  <Card
                    card={MOCK_CARDS_BY_RARITY.legendary}
                    edition={3}
                    interactive={true}
                    showAudio={true}
                  />
                  {/* Radiant Pulse */}
                  <motion.div
                    key={`radiant-${stageKey}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 0], scale: [0.5, 2, 3] }}
                    transition={{ duration: 1.2, delay: 0.2 }}
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle, rgba(196, 77, 255, 0.4) 0%, transparent 65%)',
                    }}
                  />
                </div>
                <button
                  onClick={() => {
                    playTestSfx('gold_get');
                    setStageKey((k) => k + 1);
                  }}
                  className="px-6 py-2.5 bg-[#c44dff] text-black font-black font-mono text-xs uppercase tracking-wider shadow-[3px_3px_0_#000] cursor-pointer"
                >
                  ✨ RE-PULSE RADIANT AURA
                </button>
              </div>
            )}

            {selectedAnimationId === 'stage_clear_drop' && (
              <div className="py-10 px-4 w-full max-w-xl text-center space-y-6 relative z-20">
                {/* Arcade LED Dot-Matrix Marquee */}
                <div className="w-full bg-black border-y border-emerald-500/40 py-3 overflow-hidden relative">
                  <div
                    className="absolute inset-0 z-10 pointer-events-none"
                    style={{
                      backgroundImage: 'radial-gradient(circle, transparent 38%, #000000 48%)',
                      backgroundSize: '3px 3px',
                    }}
                  />
                  <div className="flex w-max relative whitespace-nowrap animate-marquee">
                    <span
                      className="font-mono text-xs font-black tracking-[0.25em] text-emerald-400 pr-8"
                      style={{ textShadow: '0 0 8px #39ff14' }}
                    >
                      ★★★ CONGRATULATIONS! STAGE CLEARED ★★★ PERFECT ACCURACY DETECTED ★★★ PLATINUM REWARD BUNDLE UNLOCKED ★★★
                    </span>
                  </div>
                </div>

                {/* Score & Medal Dial Display */}
                <div className="p-6 bg-black/80 border border-emerald-500/30 rounded-xl space-y-4">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                    PERFECT SIGNAL LOCKED // ACCURACY: 98.4%
                  </span>
                  <div className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight">
                    PLATINUM CLEAR
                  </div>
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded text-left font-mono text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Unlocked Loot:</span>
                      <span className="text-emerald-300 font-bold">🏆 PROPHECY PACK (3× CARDS)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Mythic Chance:</span>
                      <span className="text-amber-400 font-bold">3.0% ELEVATED</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      playTestSfx('platinum_get');
                      alert('Claim Reward launched Pack Reveal!');
                    }}
                    className="w-full py-3 bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-black uppercase tracking-wider text-xs shadow-[3px_3px_0_#000] cursor-pointer"
                  >
                    CLAIM STAGE DROP REWARD →
                  </button>
                </div>
              </div>
            )}

            {selectedAnimationId === 'forge_fusion' && (
              <div className="py-12 flex flex-col items-center justify-center relative z-20 space-y-6">
                <div className="text-center space-y-2">
                  <span className="text-orange-400 font-mono text-[10px] tracking-widest uppercase font-bold px-3 py-1 bg-orange-500/10 border border-orange-500/30 rounded-full">
                    🔥 3-CARD DUPLICATE CONVERGENCE
                  </span>
                  <h3 className="text-2xl font-black uppercase text-white">FORGE ASCENSION IGNITION</h3>
                </div>

                <div className="flex items-center gap-4 relative">
                  {[1, 2, 3].map((cardNum) => (
                    <motion.div
                      key={cardNum}
                      animate={{
                        x: [0, (2 - cardNum) * -20, 0],
                        scale: [1, 0.95, 1],
                        rotate: [(cardNum - 2) * 5, 0, (cardNum - 2) * 5],
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-24 md:w-28 opacity-80"
                    >
                      <Card
                        card={MOCK_CARDS_BY_RARITY.common}
                        edition={cardNum}
                        interactive={false}
                      />
                    </motion.div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    playTestSfx('fusion');
                    alert('Cards fused into upgraded Rare artifact!');
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-black font-black font-mono text-xs uppercase tracking-wider shadow-[3px_3px_0_#000] cursor-pointer"
                >
                  🔥 IGNITE FORGE FUSION
                </button>
              </div>
            )}

            {selectedAnimationId === 'daily_beacon_scanner' && (
              <div className="py-12 flex flex-col items-center justify-center relative z-20 space-y-6">
                <div className="w-16 h-16 rounded-full border-2 border-purple-500/40 flex items-center justify-center text-purple-400 text-2xl animate-pulse">
                  <Radio size={28} className="animate-spin" />
                </div>
                <div className="text-center space-y-2">
                  <div className="text-sm font-mono text-[#ff1493] uppercase font-bold tracking-widest animate-pulse">
                    CALIBRATING STAGE TO TODAY'S DROP...
                  </div>
                  <p className="text-xs font-mono text-zinc-500">
                    CALENDAR ARCHIVE FREQUENCY: DAY 281 // LATENCY: 12ms NOMINAL
                  </p>
                </div>
                <button
                  onClick={() => {
                    playTestSfx('tap_nav');
                    alert('Locked onto Day 281 Daily Drop!');
                  }}
                  className="px-6 py-2.5 bg-purple-600 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0_#000] cursor-pointer"
                >
                  LOCK BEACON SIGNAL
                </button>
              </div>
            )}

            {selectedAnimationId === 'genesis_proof_stamp' && (
              <div className="py-12 flex flex-col items-center justify-center relative z-20 space-y-6">
                <div className="relative w-[260px] md:w-[290px]">
                  <Card
                    card={MOCK_CARDS_BY_RARITY.rare}
                    edition={1}
                    interactive={true}
                    showAudio={true}
                    proof="proof_of_first"
                  />
                  {/* Proof Badge Pop Animation */}
                  <motion.div
                    key={`proof-badge-${stageKey}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 350, damping: 20 }}
                    className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-mono font-black tracking-wider uppercase z-50 whitespace-nowrap"
                    style={{
                      background: 'linear-gradient(135deg, rgba(167,139,250,0.3), rgba(167,139,250,0.1))',
                      border: '1.5px solid rgba(167,139,250,0.6)',
                      color: '#a78bfa',
                      boxShadow: '0 0 15px rgba(167,139,250,0.4)',
                    }}
                  >
                    🔮 PROOF OF FIRST (1/1)
                  </motion.div>
                </div>
                <button
                  onClick={() => {
                    playTestSfx('diamond');
                    setStageKey((k) => k + 1);
                  }}
                  className="px-6 py-2.5 bg-purple-500 text-black font-black font-mono text-xs uppercase tracking-wider shadow-[3px_3px_0_#000] cursor-pointer"
                >
                  POP GENESIS 1/1 STAMP
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== VIEW MODE 2: GACHA RNG ROLLER ===== */}
      {viewMode === 'gacha_sim' && (
        <div
          className="p-6 relative border border-amber-500/30 bg-black/90 space-y-6"
          style={{ boxShadow: '8px 8px 0 #000' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <span className="text-[9px] font-mono uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                PROBABILISTIC GACHA ENGINE
              </span>
              <h2 className="text-2xl font-black uppercase text-white mt-1">
                RNG DROP ROLLER & LIVE TEST FIRE
              </h2>
            </div>
            <button
              onClick={handleSimulateGachaRoll}
              className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black font-mono text-xs uppercase tracking-wider shadow-[3px_3px_0_#000] hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              🎲 ROLL RANDOM DROP NOW
            </button>
          </div>

          {/* Active Rates Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { rarity: 'common', label: 'COMMON', rate: '60.0%', color: '#7a8090' },
              { rarity: 'uncommon', label: 'UNCOMMON', rate: '25.0%', color: '#00d4aa' },
              { rarity: 'rare', label: 'RARE', rate: '12.0%', color: '#4d8fff' },
              { rarity: 'legendary', label: 'LEGENDARY', rate: '3.0%', color: '#c44dff' },
              { rarity: 'mythic', label: 'MYTHIC 1/1', rate: '0.1% ~ 3%', color: '#ffd700' },
            ].map((tier) => (
              <div
                key={tier.rarity}
                className="p-3 bg-black/60 border border-white/10 text-center space-y-1"
                style={{
                  borderColor: selectedRarity === tier.rarity ? tier.color : undefined,
                  boxShadow: selectedRarity === tier.rarity ? `0 0 15px ${tier.color}30` : undefined,
                }}
              >
                <span className="text-[9px] font-mono tracking-widest uppercase block text-zinc-500">
                  {tier.label}
                </span>
                <span className="text-xl font-black font-mono" style={{ color: tier.color }}>
                  {tier.rate}
                </span>
              </div>
            ))}
          </div>

          {gachaRollResult && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono uppercase text-amber-400">LAST ROLL OUTCOME:</span>
                <div className="text-lg font-black uppercase text-white">
                  [{gachaRollResult.rolledRarity.toUpperCase()}] PULLED FROM {gachaRollResult.packType.toUpperCase()} PACK
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedAnimationId(
                    gachaRollResult.rolledRarity === 'mythic' ? 'mythic_supernova' : 'cinematic_pack'
                  );
                  setViewMode('stage');
                }}
                className="px-4 py-2 bg-white text-black font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                PLAY ROLL ANIMATION →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== VIEW MODE 3: FULL DROP ANIMATION CATALOG GRID ===== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
            <Layers size={18} className="text-[#ff007f]" />
            ALL DROP ANIMATION SEQUENCES ({DROP_ANIMATION_CATALOG.length})
          </h2>
          <span className="text-xs font-mono text-zinc-500">Click any card to test fire live</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DROP_ANIMATION_CATALOG.map((item) => {
            const isSelected = selectedAnimationId === item.id;
            return (
              <div
                key={item.id}
                className={`p-5 relative transition-all border ${
                  isSelected
                    ? 'bg-zinc-900/90 border-white/40 shadow-[4px_4px_0_#ff007f]'
                    : 'bg-black/80 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[8px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                        style={{
                          background: `${item.badgeColor}20`,
                          color: item.badgeColor,
                          border: `1px solid ${item.badgeColor}40`,
                        }}
                      >
                        {item.badge}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-500 uppercase">{item.category}</span>
                    </div>
                    <h3 className="text-lg font-black uppercase text-white tracking-tight">{item.name}</h3>
                    <p className="text-xs font-mono text-zinc-400 mt-0.5">{item.tagline}</p>
                  </div>

                  <button
                    onClick={() => triggerAnimationTest(item.id)}
                    className="px-3 py-2 text-black font-mono text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0_#000] hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    style={{ background: item.badgeColor }}
                  >
                    <Play size={11} fill="#000" /> TEST FIRE
                  </button>
                </div>

                <p className="text-xs font-mono text-zinc-300 leading-relaxed mb-4">{item.description}</p>

                {/* Technical Metadata Pills */}
                <div className="space-y-2 pt-3 border-t border-white/10 text-[9px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 uppercase">Trigger:</span>
                    <span className="text-zinc-300">{item.triggerLocation}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-zinc-500 uppercase mr-1">Audio:</span>
                    {item.audioStems.map((stem) => (
                      <span
                        key={stem}
                        className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-zinc-400 rounded"
                      >
                        ♫ {stem}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[8px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <FileCode size={10} /> {item.sourceFile}
                    </span>
                    <span className="text-zinc-400">{item.techStack.join(' • ')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== MODAL PREVIEWS (Ultra Reward & Decryption) ===== */}
      <UltraRewardModal
        isOpen={showUltraModal}
        onClose={() => setShowUltraModal(false)}
        isFreshFind={true}
      />

      {showDecryptionModal && (
        <DecryptionAnimation
          reward={{
            type: 'card',
            value: 'Day 100 Mythic Afterlife',
            code: 'VAULT-ALPHA-777',
            details: {
              card: MOCK_CARDS_BY_RARITY.mythic,
              tokensGranted: 500,
            },
          }}
          onClose={() => setShowDecryptionModal(false)}
        />
      )}
    </div>
  );
}
