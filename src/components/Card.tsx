import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { VaultCard } from '../services/vaultService';
import { RARITY_CONFIG, getSupplyCap, type UltraReward, type ProofType } from '../utils/rarity';
import { getCoverUrlForRarity, useSmartCoverArt } from '../utils/rarityArtwork';
import RarityBadge from './RarityBadge';
import AudioPreview from './AudioPreview';
import { formatDate } from '../utils/dayCalc';
import { Gift, Flame, ShieldCheck } from 'lucide-react';
import OneOfOneOutline from './OneOfOneOutline';
import HoloSheen, { type HoloVariant } from './HoloSheen';
import { useHoloTilt } from '../hooks/useHoloTilt';
import MythicCardEffects, { MythicGodRays, MythicPrismFoil, MythicEmberParticles, MythicCrownBadge } from './MythicCardEffects';
import {
  CardSkinContext,
  CardOriginal, CardGlitch, CardGlass, CardArcade, CardMtg, CardPoker, CardDuelist, CardMonster, CardChrome, CardFantasy, CardCyberpunk, CardAnime,
  BackOriginal, BackGlitch, BackGlass, BackArcade, BackMtg, BackPoker, BackDuelist, BackMonster, BackChrome, BackFantasy, BackCyberpunk, BackAnime
} from '../pages/CardDesignShowcase';

function renderCardBack(card: VaultCard, backSkin: string) {
  if (backSkin === 'glitch') return <BackGlitch card={card} />;
  if (backSkin === 'glass') return <BackGlass card={card} />;
  if (backSkin === 'arcade') return <BackArcade card={card} />;
  if (backSkin === 'mtg') return <BackMtg card={card} />;
  if (backSkin === 'poker') return <BackPoker card={card} />;
  if (backSkin === 'duelist') return <BackDuelist card={card} />;
  if (backSkin === 'monster') return <BackMonster card={card} />;
  if (backSkin === 'chrome') return <BackChrome card={card} />;
  if (backSkin === 'fantasy') return <BackFantasy card={card} />;
  if (backSkin === 'cyberpunk') return <BackCyberpunk card={card} />;
  if (backSkin === 'anime') return <BackAnime card={card} />;
  return <BackOriginal card={card} />;
}

const CORNER_MARKS = [{t:true,l:true},{t:true,l:false},{t:false,l:true},{t:false,l:false}];

function getSkinComponent(skin: string) {
  if (skin === 'glitch') return CardGlitch;
  if (skin === 'glass') return CardGlass;
  if (skin === 'arcade') return CardArcade;
  if (skin === 'mtg') return CardMtg;
  if (skin === 'poker') return CardPoker;
  if (skin === 'duelist') return CardDuelist;
  if (skin === 'monster') return CardMonster;
  if (skin === 'chrome') return CardChrome;
  if (skin === 'fantasy') return CardFantasy;
  if (skin === 'cyberpunk') return CardCyberpunk;
  if (skin === 'anime') return CardAnime;
  return CardOriginal;
}

interface CardProps {
  card: VaultCard;
  edition?: number;
  showAudio?: boolean;
  showClaim?: boolean;
  onClaim?: () => void;
  delay?: number;
  interactive?: boolean;
  isDailyClaim?: boolean;
  isDailyOrigin?: boolean;
  ultraReward?: UltraReward;
  isRevealed?: boolean;
  isEcho?: boolean;
  echoGeneration?: number;
  onBurn?: () => void;
  proof?: ProofType;
  showBackOnly?: boolean;
}

function PimLogo({ color, cardId }: { color?: string; cardId?: string }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-1 select-none">
      <img
        src="/data/logos/card_back_logo.png"
        alt="PIM Card Back Crest"
        className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(255,215,0,0.65)]"
        loading="lazy"
      />
    </div>
  );
}

function DayNumberBadge({ day, color }: { day: number; color: string }) {
  const formattedDay = `#${String(day).padStart(3, '0')}`;
  return (
    <svg width="74" height="24" viewBox="0 0 112 34" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
      <path 
        d="M 10 2 L 102 2 L 110 10 L 110 24 L 102 32 L 10 32 L 2 24 L 2 10 Z" 
        fill="rgba(8, 6, 4, 0.84)" 
        stroke={`${color}55`} 
        strokeWidth="1.5" 
      />
      <path 
        d="M 12 4.5 L 100 4.5 L 107.5 11.5 L 107.5 22.5 L 100 29.5 L 12 29.5 L 4.5 22.5 L 4.5 11.5 Z" 
        fill={`${color}10`} 
        stroke={`${color}22`} 
        strokeWidth="0.75" 
      />
      <line x1="7" y1="17" x2="12" y2="17" stroke={`${color}70`} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="100" y1="17" x2="105" y2="17" stroke={`${color}70`} strokeWidth="1.5" strokeLinecap="round" />
      <text
        x="56"
        y="18"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        fontSize="12"
        fontWeight="bold"
        letterSpacing="1"
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
      >
        {formattedDay}
      </text>
    </svg>
  );
}

// Shared recessed hardware LED stat well primitive
function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 3px',
      background: 'linear-gradient(180deg, rgba(6, 5, 3, 0.84) 0%, rgba(16, 13, 9, 0.92) 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderBottomColor: 'rgba(255,255,255,0.14)',
      borderRadius: '5px',
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.85)',
    }}>
      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '6.5px', color: 'rgba(250,240,216,0.42)', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1, marginBottom: '2px' }}>{label}</span>
      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 8px ${color}35` }}>{value}</span>
    </div>
  );
}

/**
 * CardCornerMedallions
 * Non-overlapping circular corner hardware seals for Bombshell, Daily Drop, and Echo Re-Entry.
 * Docked in the upper-right artwork corner below the card header bar so they never collide
 * with DayNumberBadge or RarityBadge.
 */
export function CardCornerMedallions({
  isBombshell = false,
  isDaily = false,
  isEcho = false,
  echoGeneration = 0,
}: {
  isBombshell?: boolean;
  isDaily?: boolean;
  isEcho?: boolean;
  echoGeneration?: number;
}) {
  if (!isBombshell && !isDaily && !isEcho) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '42px',
        right: '8px',
        zIndex: 36,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {/* 1. BOMBSHELL CIRCULAR MEDALLION SEAL */}
      {isBombshell && (
        <div
          title="Bombshell Edition"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 28%, #ff3d9e 0%, #8a0047 62%, #280015 100%)',
            border: '1.5px solid #ff85c2',
            boxShadow: '0 3px 8px rgba(0,0,0,0.85), 0 0 14px rgba(255,20,147,0.7), inset 0 1px 2px rgba(255,255,255,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="14.5" stroke="#ffd700" strokeOpacity="0.55" strokeWidth="0.8" strokeDasharray="2.5 1.5" />
            <circle cx="18" cy="18" r="12.5" stroke="#ff99cc" strokeOpacity="0.3" strokeWidth="0.6" />
            {/* Bombshell Heart + Starburst Crest */}
            <path
              d="M18 16.2C18 16.2 13.2 13.1 13.2 10.3C13.2 8.8 14.4 7.7 15.8 7.7C16.7 7.7 17.5 8.2 18 8.9C18.5 8.2 19.3 7.7 20.2 7.7C21.6 7.7 22.8 8.8 22.8 10.3C22.8 13.1 18 16.2 18 16.2Z"
              fill="#ffffff"
              stroke="#ffd700"
              strokeWidth="0.7"
            />
            <polygon points="24,6.5 24.6,8 26.2,8.2 25,9.2 25.3,10.7 24,9.9 22.7,10.7 23,9.2 21.8,8.2 23.4,8" fill="#ffd700" />
            <text
              x="18"
              y="21.5"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontFamily="'JetBrains Mono', 'Impact', sans-serif"
              fontSize="5.1"
              fontWeight="900"
              letterSpacing="0.4"
            >
              BOMB
            </text>
            <text
              x="18"
              y="26.4"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffd700"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="4.5"
              fontWeight="800"
              letterSpacing="0.3"
            >
              SHELL
            </text>
          </svg>
        </div>
      )}

      {/* 2. DAILY DROP CIRCULAR MEDALLION SEAL */}
      {isDaily && (
        <div
          title="Daily Drop Claim"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 28%, #573d00 0%, #241800 65%, #0e0900 100%)',
            border: '1.5px solid #ffd700',
            boxShadow: '0 3px 8px rgba(0,0,0,0.85), 0 0 14px rgba(255,215,0,0.55), inset 0 1px 2px rgba(255,255,255,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="14.5" stroke="#ffd700" strokeOpacity="0.55" strokeWidth="0.8" strokeDasharray="2 1.5" />
            {/* Crown / Gift Sunburst Icon */}
            <rect x="13.5" y="10.5" width="9" height="6" rx="1" stroke="#ffd700" strokeWidth="1.1" fill="rgba(255,215,0,0.18)" />
            <line x1="18" y1="9.5" x2="18" y2="16.5" stroke="#ffd700" strokeWidth="1.1" />
            <line x1="13.5" y1="13" x2="22.5" y2="13" stroke="#ffd700" strokeWidth="1" />
            <path d="M18 10.5C16.5 10.5 15.5 9.6 15.5 8.7C15.5 8 16.1 7.5 16.8 7.5C17.5 7.5 18 8.4 18 10.5Z" stroke="#fff" strokeWidth="0.9" />
            <path d="M18 10.5C19.5 10.5 20.5 9.6 20.5 8.7C20.5 8 19.9 7.5 19.2 7.5C18.5 7.5 18 8.4 18 10.5Z" stroke="#fff" strokeWidth="0.9" />
            <text
              x="18"
              y="22.2"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="5"
              fontWeight="900"
              letterSpacing="0.4"
            >
              DAILY
            </text>
            <text
              x="18"
              y="26.8"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffd700"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="4.4"
              fontWeight="800"
              letterSpacing="0.4"
            >
              DROP
            </text>
          </svg>
        </div>
      )}

      {/* 3. ECHO RE-ENTRY CIRCULAR MEDALLION SEAL */}
      {isEcho && (
        <div
          title={`Echo Re-Entry Gen ${echoGeneration || 1}`}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 28%, #004d3d 0%, #001f19 65%, #020c0a 100%)',
            border: '1.5px solid #00d4aa',
            boxShadow: '0 3px 8px rgba(0,0,0,0.85), 0 0 14px rgba(0,212,170,0.55), inset 0 1px 2px rgba(255,255,255,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="14.5" stroke="#00d4aa" strokeOpacity="0.5" strokeWidth="0.8" strokeDasharray="3 1.5" />
            {/* Radar Pulse Waves */}
            <circle cx="18" cy="12" r="4.5" stroke="#00d4aa" strokeOpacity="0.55" strokeWidth="0.9" />
            <circle cx="18" cy="12" r="2" fill="#00ffcc" />
            <line x1="11.5" y1="12" x2="13" y2="12" stroke="#00ffcc" strokeWidth="0.9" />
            <line x1="23" y1="12" x2="24.5" y2="12" stroke="#00ffcc" strokeWidth="0.9" />
            <text
              x="18"
              y="21.8"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#00ffcc"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="5"
              fontWeight="900"
              letterSpacing="0.4"
            >
              ECHO
            </text>
            <text
              x="18"
              y="26.6"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="4.6"
              fontWeight="800"
              letterSpacing="0.3"
            >
              {`G·0${echoGeneration || 1}`}
            </text>
          </svg>
        </div>
      )}
    </div>
  );
}

function ProofSeal({ type }: { type: ProofType }) {
  if (!type || (type !== 'proof_of_first' && type !== 'proof_of_listen')) return null;
  const isFirst = type === 'proof_of_first';
  const color = isFirst ? '#a78bfa' : '#ef4444';
  const icon = isFirst ? '🔮' : '🎲';
  const label = isFirst ? 'PROOF OF FIRST' : 'HEARD FIRST';
  
  return (
    <div style={{
      position: 'absolute', top: '42px', left: '8px',
      transform: 'rotate(-6deg)',
      zIndex: 45,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: '#fff', border: `2px solid ${color}`,
        padding: '4px 9px', boxShadow: `3px 3px 0 #000, 0 0 16px ${color}40`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: '11px', lineHeight: 1 }}>{icon}</span>
        <span style={{ 
          fontFamily: '"Impact", sans-serif', fontSize: '8.5px', 
          color: '#000', textTransform: 'uppercase', lineHeight: 1,
          marginTop: '2px', letterSpacing: '0.02em'
        }}>{label}</span>
        <div style={{ 
          width: '100%', height: '1px', background: color, 
          margin: '2px 0', opacity: 0.25 
        }} />
        <span style={{ 
          fontFamily: '"JetBrains Mono", monospace', fontSize: '7.5px', 
          fontWeight: 900, color: '#000', lineHeight: 1
        }}>1 / 1</span>
      </div>
    </div>
  );
}

export default memo(function Card({
  card,
  edition,
  showAudio = false,
  showClaim = false,
  onClaim,
  delay = 0,
  interactive = true,
  isDailyClaim = false,
  isDailyOrigin = false,
  ultraReward,
  isRevealed = true,
  isEcho = false,
  echoGeneration = 0,
  onBurn,
  proof,
  showBackOnly = false,
}: CardProps) {
  const [isFaceDown, setIsFaceDown] = useState(!isRevealed);
  const [imgError, setImgError] = useState(false);
  const [hasFlipped, setHasFlipped] = useState(isRevealed);
  const [realClaimed, setRealClaimed] = useState<number | null>(null);
  const [activeCardBack, setActiveCardBack] = useState('classic');
  const [activeCardSkin, setActiveCardSkin] = useState('original');
  useEffect(() => {
    const reloadSkins = () => {
      try {
        const cb = localStorage.getItem('opt_cardBack') || 'classic';
        setActiveCardBack(cb);
        const skin = localStorage.getItem('opt_cardSkin') || 'original';
        setActiveCardSkin(skin);
      } catch (e) {
        // ignore
      }
    };
    reloadSkins();
    window.addEventListener('card_skins_changed', reloadSkins);
    return () => window.removeEventListener('card_skins_changed', reloadSkins);
  }, []);

  // Holographic sheen: pointer / phone-tilt driven light + gentle 3D tilt.
  const tiltRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  useHoloTilt(tiltRef, sheenRef, { maxTilt: interactive ? 9 : 0, gyro: interactive });

  const rotateY = useMotionValue(!isRevealed ? 180 : 0);
  const frontVisibility = useTransform(rotateY, v => (Math.abs(v % 360) < 90 || Math.abs(v % 360) > 270 ? 'visible' : 'hidden'));
  const backVisibility  = useTransform(rotateY, v => (Math.abs(v % 360) >= 90 && Math.abs(v % 360) <= 270 ? 'visible' : 'hidden'));

  useEffect(() => {
    if (edition === undefined && card.claimedCount && card.claimedCount > 0) {
      setRealClaimed(card.claimedCount);
      return;
    }
    // Per-rarity count only: the supply cap this feeds is per-rarity, so a
    // day-total across all rarities must never be compared against it.
    import('../services/vaultService').then(({ getClaimedCountForRarity }) => {
      getClaimedCountForRarity(card.day || 0, card.rarity || 'common').then(setRealClaimed);
    });
  }, [card.day, card.rarity, card.claimedCount, edition]);

  useEffect(() => {
    // Only auto-flip to front when isRevealed prop transitions to true
    if (isRevealed && isFaceDown) {
      animate(rotateY, 0, { type: 'spring', stiffness: 260, damping: 26, mass: 0.8 });
      setIsFaceDown(false);
      // Wait exactly until it passes 90 deg so the back face swap isn't visible
      setTimeout(() => setHasFlipped(true), 150);
    } else if (isRevealed && !hasFlipped) {
      setHasFlipped(true);
    }
  }, [isRevealed]); // Removed isFaceDown and rotateY from dependencies

  const handleClick = useCallback(() => {
    if (!interactive) return;
    const target = isFaceDown ? 0 : 180;
    animate(rotateY, target, { type: 'spring', stiffness: 260, damping: 26, mass: 0.8 });
    setIsFaceDown(!isFaceDown);
  }, [interactive, isFaceDown, rotateY]);

  const { src: coverUrl, failed: imgFailed, handleError: handleImgError, isSquare } = useSmartCoverArt(
    card?.coverUrl || '',
    card?.rarity || 'common'
  );

  if (!card || !card.rarity) return null;

  const rc = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.common;
  const title   = card.title || 'Unknown';
  const day     = card.day || 0;
  const mood    = card.mood || 'dark';
  const energy  = card.energy  ?? 0;
  const valence = card.valence ?? 0;
  const tempo   = card.tempo   ?? 0;
  const supply  = getSupplyCap(card.rarity, card.day);
  const claimed = (edition === undefined && card.claimedCount && card.claimedCount > 0)
    ? card.claimedCount
    : (realClaimed ?? (edition === undefined ? (card.claimedCount ?? 0) : 0));
  const audioUrl = card.audioUrl || '';
  const hasArt   = !imgError && !imgFailed && coverUrl;

  // ── Overlay state classification ──────────────────────────────────────────
  // Excess is a property of a specific copy (its edition number), never of
  // aggregate claim counts — a filled print run makes its last copy a
  // trophy, not an excess copy. Nothing in PIM is minted yet, so no state
  // here is ever labelled "minted".
  const isExcessEdition = edition !== undefined && edition > supply;
  const isOnlyOne       = supply === 1 && (edition === 1 || (edition === undefined && claimed <= 1));
  const isLastCopy      = !isExcessEdition && !isOnlyOne && edition !== undefined && edition === supply && supply > 1;
  const isBombshell     = Boolean(card.cardSet === 'bombshell' || (card.id && card.id.includes('bombshell')) || (coverUrl && (coverUrl.includes('girl-covers') || coverUrl.includes('rare_covers'))));

  const mintPct = supply > 0 ? (Math.min(claimed, supply) / supply) * 100 : 0;

  const renderArt = (className = 'w-full h-full', rotated = false) => {
    const shouldRotate = rotated && !isSquare;
    return hasArt ? (
      <img
        src={coverUrl}
        alt={title}
        className={`${className} object-cover`}
        style={{
          ...(shouldRotate ? { transform: 'rotate(90deg) scale(1.35)', transformOrigin: 'center' } : undefined),
          ...(isEcho ? { filter: `grayscale(${Math.min(30 + echoGeneration * 15, 70)}%) contrast(1.15) brightness(0.9)` } : {}),
        }}
        onError={handleImgError}
        loading="lazy"
      />
    ) : (
      <div className={`${className} flex items-center justify-center`} style={{
        background: `linear-gradient(135deg, ${rc.color}18, #050402, ${rc.color}10)`,
      }}>
        <span style={{ fontFamily: '"Impact", sans-serif', fontSize: '64px', color: `${rc.color}30`, lineHeight: 1 }}>{String(day).padStart(3, '0')}</span>
      </div>
    );
  };

  // ── Claim button shared ──────────────────────────────────────────────────
  const claimBtn = showClaim && onClaim && (
    <button
      onClick={e => { e.stopPropagation(); onClaim(); }}
      style={{
        width: '100%', marginTop: '8px', padding: '10px',
        background: rc.color, color: '#000', fontWeight: 900,
        fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
        border: `1px solid ${rc.color}`, borderRadius: '6px',
        cursor: 'pointer', boxShadow: `0 4px 20px ${rc.color}55`,
      }}
    >
      Claim Card
    </button>
  );

  // ── Mint bar shared ──────────────────────────────────────────────────────
  const mintBar = (
    <div style={{ height: '3px', background: 'rgba(255,255,255,0.09)', borderRadius: '999px', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.7)' }}>
      <div style={{ height: '100%', width: `${mintPct}%`, background: `linear-gradient(90deg, ${rc.color}cc, ${rc.color})`, borderRadius: '999px', boxShadow: `0 0 8px ${rc.color}99` }} />
    </div>
  );

  // ── Daily perimeter aura — badge is now rendered in CardCornerMedallions ─
  const dailyOverlay = (isDailyClaim || isDailyOrigin) && (
    <motion.div
      style={{
        position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none', borderRadius: '12px', overflow: 'hidden',
        backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
        rotateY: 0, visibility: frontVisibility,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, border: '1.5px solid rgba(255,215,0,0.32)', borderRadius: '12px', boxShadow: 'inset 0 0 22px rgba(255,215,0,0.08)' }} />
    </motion.div>
  );

  // ── Non-overlapping Corner Circle Medallions (Bombshell / Daily / Echo) ──
  const cornerMedallionsOverlay = (isBombshell || isDailyClaim || isDailyOrigin || isEcho) && (
    <motion.div
      style={{
        position: 'absolute', inset: 0, zIndex: 36, pointerEvents: 'none', borderRadius: '12px', overflow: 'hidden',
        backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
        rotateY: 0, visibility: frontVisibility,
      }}
    >
      <CardCornerMedallions
        isBombshell={isBombshell}
        isDaily={Boolean(isDailyClaim || isDailyOrigin)}
        isEcho={isEcho}
        echoGeneration={echoGeneration}
      />
    </motion.div>
  );


  // ── 1-of-1 / Only One outline — scrolling perimeter marquee replacing old center stamp ──
  const onlyOneOutline = (isOnlyOne || card.rarity === 'mythic') && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 38,
        pointerEvents: 'none',
        visibility: frontVisibility,
      }}
    >
      <OneOfOneOutline color="#ffd700" speedSec={14} />
    </motion.div>
  );

  // ── Last copy — trophy treatment, never a penalty ───────────────────────
  // This copy closed the print run: art stays full colour, framed in the
  // rarity colour with a FINAL PRINT seal.
  const lastCopyBadge = isLastCopy && (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        style={{
          position: 'absolute', inset: 0, zIndex: 39, pointerEvents: 'none', borderRadius: '12px',
          border: `1.5px solid ${rc.color}66`,
          boxShadow: `inset 0 0 26px ${rc.color}26, 0 0 18px ${rc.color}33`,
          visibility: frontVisibility,
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          position: 'absolute', bottom: '38px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 41, pointerEvents: 'none',
          visibility: frontVisibility,
        }}
      >
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
          padding: '5px 12px',
          border: `1.5px solid ${rc.color}`,
          color: rc.color,
          fontFamily: '"JetBrains Mono", monospace',
          textTransform: 'uppercase',
          background: 'rgba(0,0,0,0.88)',
          borderRadius: '3px',
          boxShadow: `0 0 16px ${rc.color}55`,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: '8px', fontWeight: 900, letterSpacing: '0.22em' }}>✦ Final Print ✦</span>
          <span style={{ fontSize: '6px', fontWeight: 700, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.75)' }}>
            Last copy {edition}/{supply} · Run closed · Never reissued
          </span>
        </div>
      </motion.div>
    </>
  );

  // ── Excess copy overlay — only for actual excess copies (edition > supply) ─
  const excessOverlay = isExcessEdition && (
    <motion.div
      style={{
        position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none', borderRadius: '12px',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'grayscale(1) contrast(1.1)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '20px',
        visibility: frontVisibility,
      }}
    >
      {/* EXCESS COPY stamp */}
      <div style={{
        padding: '6px 14px', border: '3px solid #ff3800', color: '#ff3800',
        fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '22px',
        fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px',
        transform: 'rotate(-12deg)', background: 'rgba(0,0,0,0.9)',
        boxShadow: '0 0 24px rgba(255,56,0,0.5)',
        textShadow: '0 0 12px rgba(255,56,0,0.8)',
      }}>
        EXCESS COPY
      </div>

      {/* Burn button — always visible, permanent fixture */}
      {onBurn && (
        <button
          onClick={(e) => { e.stopPropagation(); onBurn(); }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(255,56,0,0.9)', border: '2.5px solid rgba(255,255,255,0.9)',
            alignSelf: 'center', justifyContent: 'center',
            cursor: 'pointer', pointerEvents: 'auto',
            boxShadow: '0 0 28px rgba(255,56,0,0.85), 0 0 8px rgba(255,56,0,0.4)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          title="Burn for V⚡ sparks"
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.12)';
            e.currentTarget.style.boxShadow = '0 0 38px rgba(255,56,0,1), 0 0 12px rgba(255,56,0,0.6)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 0 28px rgba(255,56,0,0.85), 0 0 8px rgba(255,56,0,0.4)';
          }}
        >
          <Flame size={28} color="#fff" />
        </button>
      )}

      {/* Burn label */}
      {onBurn && (
        <span style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: '8px',
          fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.7)',
        }}>Burn for V⚡</span>
      )}
    </motion.div>
  );

  // ════════════════════════════════════════════════════════════════════
  // CARD BACK — ultra reward override OR standard vault design
  // ════════════════════════════════════════════════════════════════════
  const mysteryBack = (
    <motion.div
      style={{
        position: 'absolute', inset: 0, borderRadius: '12px', overflow: 'hidden',
        backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
        rotateY: 180,
        visibility: backVisibility,
        willChange: 'transform',
        background: '#0c0a07',
        clipPath: 'inset(0 round 12px)',
        WebkitClipPath: 'inset(0 round 12px)',
      }}
    >
      {/* Animated gradient mesh */}
      <div style={{ position: 'absolute', inset: '-50%', background: 'conic-gradient(from 180deg at 50% 50%, rgba(0,200,255,0.15) 0deg, rgba(255,0,255,0.1) 120deg, rgba(255,255,0,0.15) 240deg, rgba(0,200,255,0.15) 360deg)', animation: 'spin-slow 8s linear infinite', filter: 'blur(30px)' }} />

      {/* Diamond grid SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`mystery-${day}-${title}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M11 0L22 11L11 22L0 11Z" fill="none" stroke="#fff" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#mystery-${day}-${title})`} />
      </svg>

      {/* Inner double frame */}
      <div style={{ position: 'absolute', inset: '12px', border: `1px solid rgba(255,255,255,0.15)`, borderRadius: '8px' }}>
        <div style={{ position: 'absolute', inset: '6px', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: '5px' }}>

          {/* Centre emblem */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '68px', height: '68px', borderRadius: '14px',
                background: `linear-gradient(145deg, rgba(255,255,255,0.05), transparent)`,
                border: `2px solid rgba(255,255,255,0.1)`,
                boxShadow: `0 0 30px rgba(255,255,255,0.05), inset 0 0 16px rgba(255,255,255,0.02)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '36px', fontWeight: 900, color: '#fff', textShadow: `0 0 18px rgba(255,255,255,0.4)` }}>?</span>
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontFamily: '"JetBrains Mono", monospace', fontSize: '7px', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: '4px' }}>ENCRYPTED</p>
                <div style={{ width: '40px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)', margin: '0 auto' }} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const cardBack = !hasFlipped ? mysteryBack : ultraReward ? (
    // ── ULTRA REWARD BACK ────────────────────────────────────────────
    <motion.div
      style={{
        position: 'absolute', inset: 0, borderRadius: '12px', overflow: 'hidden',
        backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
        rotateY: 180,
        visibility: backVisibility,
        background: 'linear-gradient(145deg, #1a1000, #2d1f00, #1a1200)',
        clipPath: 'inset(0 round 12px)',
        WebkitClipPath: 'inset(0 round 12px)',
      }}
    >
      {/* Gold radial glow */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(255,180,0,0.22), transparent 65%)' }} />

      {/* Foil sweep */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(120deg, rgba(255,200,0,0.10) 0%, rgba(255,255,200,0.20) 25%, rgba(255,160,0,0.08) 50%, rgba(255,220,0,0.18) 75%, rgba(255,200,0,0.10) 100%)', backgroundSize: '300% 100%', animation: 'foil-sweep 3s linear infinite' }} />

      {/* Diamond grid */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`ultra-${day}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M11 0L22 11L11 22L0 11Z" fill="none" stroke="#ffd700" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#ultra-${day})`} />
      </svg>

      {/* Inner frame */}
      <div style={{ position: 'absolute', inset: '10px', border: '1px solid rgba(255,215,0,0.3)', borderRadius: '8px' }}>
        <div style={{ position: 'absolute', inset: '6px', border: '1px solid rgba(255,215,0,0.12)', borderRadius: '5px' }} />
      </div>

      {/* Content */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '20px' }}>

        {/* Seal */}
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(145deg, #ffd700, #ff9900)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(255,180,0,0.5), 0 0 0 3px rgba(255,215,0,0.2)', animation: 'pulse-glow 2.5s ease-in-out infinite' }}>
          <span style={{ fontSize: '26px', lineHeight: 1 }}>🎵</span>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontFamily: '"JetBrains Mono", monospace', fontSize: '7px', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,215,0,0.55)', marginBottom: '4px' }}>★ ULTRA REWARD ★</p>
          <p style={{ margin: 0, fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.3px', color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.6)', lineHeight: 1.1 }}>CUSTOM SONG</p>
          <p style={{ margin: '2px 0 0', fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', letterSpacing: '0.15em', color: 'rgba(255,215,0,0.5)', textTransform: 'uppercase' }}>by th3scr1b3</p>
        </div>

        {/* Divider */}
        <div style={{ width: '60px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.4), transparent)' }} />

        {/* Description */}
        <p style={{ margin: 0, fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', lineHeight: 1.6, color: 'rgba(255,240,200,0.5)', textAlign: 'center', letterSpacing: '0.05em' }}>
          {ultraReward.description}
        </p>

        {/* CTA */}
        <a
          href="/vault/claim"
          target="_self"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ marginTop: '4px', padding: '7px 16px', borderRadius: '4px', background: 'linear-gradient(135deg, #ffd700, #ff9900)', color: '#000', fontWeight: 900, fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', textDecoration: 'none', boxShadow: '0 4px 20px rgba(255,180,0,0.4)', display: 'inline-block' }}
        >
          CLAIM YOUR PRIZE →
        </a>

        {/* Serial */}
        <p style={{ margin: 0, fontFamily: '"JetBrains Mono", monospace', fontSize: '7px', color: 'rgba(255,215,0,0.25)', letterSpacing: '0.1em' }}>1 OF 5 HIDDEN</p>
      </div>

      {/* Corner marks */}
      {CORNER_MARKS.map(({t,l},i) => (
        <div key={i} style={{ position: 'absolute', width: '14px', height: '14px', top: t ? '16px' : undefined, bottom: !t ? '16px' : undefined, left: l ? '16px' : undefined, right: !l ? '16px' : undefined, borderTop: t ? '1px solid rgba(255,215,0,0.3)' : 'none', borderBottom: !t ? '1px solid rgba(255,215,0,0.3)' : 'none', borderLeft: l ? '1px solid rgba(255,215,0,0.3)' : 'none', borderRight: !l ? '1px solid rgba(255,215,0,0.3)' : 'none' }} />
      ))}
    </motion.div>
  ) : (() => {
    if (!['classic', 'holo', 'carbon', 'gold_luxe', 'matrix', 'th3scr1b3'].includes(activeCardBack)) {
      return (
        <motion.div
          style={{
            position: 'absolute', inset: 0, borderRadius: '12px', overflow: 'hidden',
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            rotateY: 180,
            visibility: backVisibility,
            willChange: 'transform',
            background: '#0c0a07',
            clipPath: 'inset(0 round 12px)',
            WebkitClipPath: 'inset(0 round 12px)',
          }}
        >
          {renderCardBack(card, activeCardBack)}
        </motion.div>
      );
    }

    const isClassic = activeCardBack === 'classic';
    const isHolo = activeCardBack === 'holo';
    const isCarbon = activeCardBack === 'carbon';
    const isGold = activeCardBack === 'gold_luxe';
    const isMatrix = activeCardBack === 'matrix';
    const isScribe = activeCardBack === 'th3scr1b3';

    const backBg = isCarbon
      ? '#090a0c'
      : isHolo
        ? 'linear-gradient(135deg, #0e1b29, #0c0a07, #210e29)'
        : isGold
          ? 'linear-gradient(135deg, #1f1a0f, #0d0c08, #1c150c)'
          : isMatrix
            ? '#030804'
            : isScribe
              ? '#0d0006'
              : '#0c0a07';

    const gridColor = isCarbon
      ? 'rgba(0,255,255,0.08)'
      : isGold
        ? 'rgba(255,215,0,0.12)'
        : isMatrix
          ? 'rgba(57,255,20,0.12)'
          : isScribe
            ? 'rgba(255,20,147,0.12)'
            : rc.color;

    const borderCol = isCarbon
      ? '#00ffff33'
      : isGold
        ? 'rgba(255,215,0,0.3)'
        : isMatrix
          ? 'rgba(57,255,20,0.25)'
          : isScribe
            ? 'rgba(255,20,147,0.25)'
            : `${rc.color}22`;

    const borderInnerCol = isCarbon
      ? '#00ffff15'
      : isGold
        ? 'rgba(255,215,0,0.12)'
        : isMatrix
          ? 'rgba(57,255,20,0.1)'
          : isScribe
            ? 'rgba(255,20,147,0.1)'
            : `${rc.color}10`;

    const emblemBorder = isCarbon
      ? '2px solid #00ffff55'
      : isGold
        ? '2px solid rgba(255,215,0,0.5)'
        : isMatrix
          ? '2px solid rgba(57,255,20,0.5)'
          : isScribe
            ? '2px dashed rgba(255,20,147,0.5)'
            : `2px solid ${rc.color}30`;

    const emblemBg = isCarbon
      ? 'rgba(0,255,255,0.05)'
      : isGold
        ? 'rgba(255,215,0,0.04)'
        : isMatrix
          ? 'rgba(57,255,20,0.04)'
          : isScribe
            ? 'rgba(255,20,147,0.04)'
            : `linear-gradient(145deg, ${rc.color}18, transparent)`;

    const logoColor = isCarbon
      ? '#00ffff'
      : isGold
        ? '#ffd700'
        : isMatrix
          ? '#39ff14'
          : isScribe
            ? '#ff007f'
            : rc.color;

    return (
      <motion.div
        style={{
          position: 'absolute', inset: 0, borderRadius: '12px', overflow: 'hidden',
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          rotateY: 180,
          visibility: backVisibility,
          willChange: 'transform',
          clipPath: 'inset(0 round 12px)',
          WebkitClipPath: 'inset(0 round 12px)',
        }}
      >
        {/* Base */}
        <div style={{ position: 'absolute', inset: 0, background: backBg }} />

        {/* Custom back styling effects */}
        {(isClassic || isHolo) && (
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 40%, ${rc.color}14, transparent 65%)` }} />
        )}
        {isHolo && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 40%, ${rc.color}22, rgba(0,229,255,0.12), transparent 70%)` }} />
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(120deg, rgba(0,229,255,0.08) 0%, rgba(255,20,147,0.12) 30%, rgba(57,255,20,0.08) 60%, rgba(0,229,255,0.08) 100%)', backgroundSize: '300% 100%', animation: 'foil-sweep 3.5s linear infinite' }} />
          </>
        )}
        {isCarbon && (
          <>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(45deg, #121316 25%, transparent 25%), linear-gradient(-45deg, #121316 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #121316 75%), linear-gradient(-45deg, transparent 75%, #121316 75%)', backgroundSize: '8px 8px', opacity: 0.7 }} />
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 40%, rgba(0,255,255,0.12), transparent 70%)` }} />
          </>
        )}
        {isGold && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(255,215,0,0.14), transparent 65%)' }} />
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(120deg, rgba(255,215,0,0.04) 0%, rgba(255,255,200,0.1) 25%, rgba(255,180,0,0.04) 50%, rgba(255,240,150,0.08) 75%, rgba(255,215,0,0.04) 100%)', backgroundSize: '300% 100%', animation: 'foil-sweep 4s linear infinite' }} />
          </>
        )}
        {isMatrix && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(57,255,20,0.14), transparent 70%)' }} />
            <div className="absolute inset-0 scanlines opacity-[0.08]" style={{ background: 'linear-gradient(rgba(57,255,20,0.08) 50%, transparent 50%)', backgroundSize: '100% 4px' }} />
          </>
        )}
        {isScribe && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, #4a002a 0%, transparent 60%), radial-gradient(circle at 70% 80%, #1a0033 0%, transparent 65%)', opacity: 0.8 }} />
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 40%, ${rc.color}15, transparent 70%)` }} />
          </>
        )}

        {/* Diamond grid SVG */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.055 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={`bp-${day}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
              <path d="M11 0L22 11L11 22L0 11Z" fill="none" stroke={gridColor} strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#bp-${day})`} />
        </svg>

        {/* Inner double frame */}
        <div style={{ position: 'absolute', inset: '12px', border: `1px solid ${borderCol}`, borderRadius: '8px' }}>
          <div style={{ position: 'absolute', inset: '6px', border: `1px solid ${borderInnerCol}`, borderRadius: '5px' }}>

            {/* Centre emblem */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>

              {/* PimLogo in circular/squircle frame */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: '84px', height: '74px', borderRadius: isScribe ? '14px' : '12px',
                  background: emblemBg,
                  border: emblemBorder,
                  boxShadow: isGold ? `0 0 25px rgba(255,215,0,0.2)` : isCarbon ? `0 0 25px rgba(0,255,255,0.2)` : isMatrix ? `0 0 25px rgba(57,255,20,0.2)` : `0 0 30px ${rc.color}15, inset 0 0 16px ${rc.color}08`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  <PimLogo color={logoColor} cardId={card.id} />
                </div>
                {['rare','legendary','mythic'].includes(card.rarity) && (
                  <div style={{ position: 'absolute', inset: '-10px', borderRadius: '16px', background: `radial-gradient(circle, ${rc.color}12, transparent 70%)`, animation: 'pulse-glow 2.5s ease-in-out infinite' }} />
                )}
              </div>

              {/* Branding */}
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontFamily: isMatrix ? '"Courier New", monospace' : '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase', color: logoColor, textShadow: isMatrix ? '0 0 8px #39ff14' : `0 0 10px ${rc.color}40` }}>
                  th3v4ult
                </span>
                <div style={{ width: '40px', height: '1px', background: isGold ? 'rgba(255,215,0,0.3)' : isCarbon ? 'rgba(0,255,255,0.3)' : `${rc.color}30` }} />
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,240,216,0.35)' }}>
                  GEN 0 {isEcho ? `· RE-ENTRY 00${echoGeneration}` : ''} · {card.rarity.toUpperCase()}
                </span>
              </div>

              {/* Day badge replaced by custom SVG */}
              <DayNumberBadge day={day} color={logoColor} />

              {/* Mythic CTA */}
              {card.rarity === 'mythic' && interactive && (
                <a href={`https://files.th3scr1b3.art/stems/${day}`} target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    padding: '7px 18px', borderRadius: '6px',
                    background: '#ffd700', color: '#000', fontWeight: 900,
                    fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase',
                    textDecoration: 'none', boxShadow: '0 0 20px rgba(255,215,0,0.4)',
                  }}
                >
                  ⬇ Download Stems
                </a>
              )}
            </div>

            {/* Corner marks */}
            {[{t:true,l:true},{t:true,l:false},{t:false,l:true},{t:false,l:false}].map(({t,l},i) => (
              <div key={i} style={{
                position: 'absolute', width: '14px', height: '14px',
                top: t ? '6px' : undefined, bottom: !t ? '6px' : undefined,
                left: l ? '6px' : undefined, right: !l ? '6px' : undefined,
                borderTop:    t ? `1px solid ${borderCol}` : 'none',
                borderBottom: !t ? `1px solid ${borderCol}` : 'none',
                borderLeft:   l ? `1px solid ${borderCol}` : 'none',
                borderRight:  !l ? `1px solid ${borderCol}` : 'none',
              }} />
            ))}
          </div>
        </div>

        {/* Scanlines for rare+ */}
        {['rare','legendary','mythic'].includes(card.rarity) && (
          <div className="absolute inset-0 scanlines opacity-[0.12]" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } as React.CSSProperties} />
        )}

        {/* Outer rarity border — static only */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '12px', opacity: 0.6,
          border: `1.5px solid ${borderCol}`,
          pointerEvents: 'none',
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
        } as React.CSSProperties} />
      </motion.div>
    );
  })();

  // ════════════════════════════════════════════════════════════════════════
  // FRONT FACES
  // ════════════════════════════════════════════════════════════════════════

  const holoVariant: HoloVariant =
    card.rarity === 'mythic' ? 'cosmic' :
    card.rarity === 'legendary' ? 'prism' :
    card.rarity === 'rare' ? 'holo' : 'gloss';
  const holoLayer = <HoloSheen ref={sheenRef} variant={holoVariant} tint={rc.color} />;

  const sharedFrontStyle = {
    position: 'absolute' as const, inset: 0, borderRadius: '12px', overflow: 'hidden',
    backfaceVisibility: 'hidden' as const, WebkitBackfaceVisibility: 'hidden' as const,
    visibility: frontVisibility,
    rotateY: 0,
    willChange: 'transform' as const,
  };

  // ── COMMON: Bold editorial / press-stamp hardware chassis ─────────────
  const commonFront = (
    <motion.div style={{
      ...sharedFrontStyle,
      background: 'linear-gradient(180deg, #120f0b 0%, #090806 100%)',
      border: `1.5px solid ${rc.color}65`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 18px rgba(0,0,0,0.8)`,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top hardware strip */}
      <div style={{
        padding: '5px 8px',
        borderBottom: `1px solid ${rc.color}28`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: `linear-gradient(90deg, ${rc.color}16 0%, rgba(0,0,0,0.5) 100%)`,
        flexShrink: 0,
      }}>
        <div style={{ transform: 'scale(0.86)', transformOrigin: 'left center' }}>
          <DayNumberBadge day={day} color={rc.color} />
        </div>
        <RarityBadge rarity={card.rarity} size="sm" />
      </div>

      {/* Art — 46% keeps info breathing room */}
      <div style={{ position: 'relative', height: '46%', flexShrink: 0, borderBottom: `1px solid ${rc.color}30`, overflow: 'hidden' }}>
        {renderArt('w-full h-full')}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 55%, rgba(0,0,0,0.65) 100%)' }} />
      </div>

      {/* Info */}
      <div style={{ padding: '7px 10px 8px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflow: 'hidden' }}>
        {/* Rule */}
        <div style={{ height: '1.5px', background: `linear-gradient(90deg, ${rc.color}80, transparent)`, flexShrink: 0 }} />
        <h3 style={{ margin: 0, fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.2px', color: '#faf0d8', lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{title}</h3>
        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          {[
            {label:'NRG', value: Math.round(energy * 100)},
            {label:'VAL', value: Math.round(valence * 100)},
            {label:'BPM', value: tempo},
            {label: mood === 'light' ? 'LGT' : 'DRK', value: mood === 'light' ? '☀' : '🌙'},
          ].map(s => <div key={s.label} style={{ flex: 1 }}><StatBox label={s.label} value={s.value} color={rc.color} /></div>)}
        </div>
        <div style={{ flexShrink: 0 }}>{mintBar}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '7.5px', fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', lineHeight: 1 }}>{claimed} PULLED</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '7.5px', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', lineHeight: 1 }}>{day > 0 ? formatDate(day) : ''}</span>
        </div>
        {showAudio && audioUrl && <div style={{ flexShrink: 0 }}><AudioPreview audioUrl={audioUrl} title={title} rarity={card.rarity} /></div>}
        {claimBtn}
        {proof && <ProofSeal type={proof} />}
      </div>
      {holoLayer}
    </motion.div>
  );

  // ── UNCOMMON: Glossy laminate frame ──────────────────────────────────
  const uncommonFront = (
    <motion.div style={{
      ...sharedFrontStyle,
      background: 'linear-gradient(180deg, #0d140f 0%, #070b08 100%)',
      border: `2px solid ${rc.color}75`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 18px ${rc.color}20`,
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Art — larger crop with clean top header bar */}
      <div style={{ position: 'relative', height: '60%', overflow: 'hidden', borderBottom: `1.5px solid ${rc.color}55`, flexShrink: 0 }}>
        {renderArt('w-full h-full')}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 28%, transparent 58%, rgba(0,0,0,0.72) 100%)' }} />
        {/* Top Day + Rarity badges on artwork header so title gets 100% width below */}
        <div style={{ position: 'absolute', top: '8px', left: '8px', transform: 'scale(0.86)', transformOrigin: 'top left', zIndex: 12 }}>
          <DayNumberBadge day={day} color={rc.color} />
        </div>
        <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 12 }}>
          <RarityBadge rarity={card.rarity} size="sm" />
        </div>
      </div>

      {/* Info strip */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
        <h3 style={{ margin: 0, fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.2px', color: '#faf0d8', lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 6px rgba(0,0,0,0.85)' }}>{title}</h3>
        <div style={{ display: 'flex', gap: '6px', fontSize: '8.5px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: rc.color, alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '3px 7px', borderRadius: '4px', border: `1px solid ${rc.color}28` }}>
          <span>{Math.round(energy * 100)} NRG</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>{tempo} BPM</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.65)', marginLeft: 'auto' }}>{mood === 'light' ? '☀ LIGHT' : '🌙 DARK'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 'auto' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '7.5px', fontWeight: 700, color: 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap' }}>{claimed} PULLED</span>
          <div style={{ flex: 1 }}>{mintBar}</div>
        </div>
        {showAudio && audioUrl && <AudioPreview audioUrl={audioUrl} title={title} rarity={card.rarity} />}
        {claimBtn}
        {proof && <ProofSeal type={proof} />}
      </div>
      {holoLayer}
    </motion.div>
  );

  // ── RARE: Full-bleed glassmorphism ────────────────────────────────────
  const rareFront = (
    <motion.div style={{
      ...sharedFrontStyle,
      border: `1.5px solid ${rc.color}85`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), 0 0 22px ${rc.color}28`,
    }}>
      {/* Full bleed art */}
      <div style={{ position: 'absolute', inset: 0 }}>{renderArt('w-full h-full')}</div>
      {/* Tinted overlay */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,0.42) 0%, transparent 32%, rgba(0,0,0,0.55) 64%, rgba(4,10,20,0.94) 100%)` }} />
      {/* Sapphire tint */}
      <div style={{ position: 'absolute', inset: 0, background: `${rc.color}0a`, pointerEvents: 'none' }} />

      {/* Top Header: Day left, Rarity right */}
      <div style={{ position: 'absolute', top: '8px', left: '8px', transform: 'scale(0.88)', transformOrigin: 'top left', zIndex: 15 }}>
        <DayNumberBadge day={day} color={rc.color} />
      </div>
      <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 15 }}>
        <RarityBadge rarity={card.rarity} size="sm" />
      </div>

      {/* Glass info drawer */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '11px 12px 12px',
        background: 'linear-gradient(180deg, rgba(8,16,32,0.68) 0%, rgba(4,8,18,0.88) 100%)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderTop: `1px solid ${rc.color}55`,
        boxShadow: '0 -6px 20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
        zIndex: 15,
      }}>
        <h3 style={{ margin: '0 0 5px', fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.2px', color: '#faf0d8', lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 2px 8px rgba(0,0,0,0.85)' }}>{title}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '4px' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{claimed} PULLED · {mood === 'light' ? '☀' : '🌙'} {mood}</span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', fontWeight: 700, color: '#e0f2fe', background: `${rc.color}30`, border: `1px solid ${rc.color}65`, padding: '1px 6px', borderRadius: '999px', whiteSpace: 'nowrap' }}>{Math.round(energy * 100)} NRG</span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', fontWeight: 700, color: rc.color, background: 'rgba(0,0,0,0.45)', border: `1px solid ${rc.color}45`, padding: '1px 6px', borderRadius: '999px', whiteSpace: 'nowrap' }}>{tempo} BPM</span>
          </div>
        </div>
        {mintBar}
        {showAudio && audioUrl && <div style={{ marginTop: '6px' }}><AudioPreview audioUrl={audioUrl} title={title} rarity={card.rarity} /></div>}
        {claimBtn}
      </div>
      {proof && <ProofSeal type={proof} />}
      {holoLayer}
    </motion.div>
  );

  // ── LEGENDARY: Foil + gradient ────────────────────────────────────────
  const legendaryFront = (
    <motion.div style={{
      ...sharedFrontStyle,
      border: `2px solid ${rc.color}95`,
      boxShadow: `inset 0 0 18px ${rc.color}35, 0 0 24px ${rc.color}30`,
    }}>
      {/* Art */}
      <div style={{ position: 'absolute', inset: 0 }}>{renderArt('w-full h-full', true)}</div>

      {/* Gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.58) 0%, transparent 24%, transparent 48%, rgba(12,4,22,0.78) 74%, rgba(6,2,12,0.97) 100%)' }} />

      {/* Top badges: DayNumberBadge on Left, Legendary Crown Pill on Right */}
      <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 18 }}>
        <div style={{ transform: 'scale(0.86)', transformOrigin: 'left center' }}>
          <DayNumberBadge day={day} color={rc.color} />
        </div>
        <div style={{
          padding: '4px 11px',
          background: `linear-gradient(135deg, rgba(20,8,36,0.9) 0%, ${rc.color}40 100%)`,
          border: `1px solid ${rc.color}95`,
          borderRadius: '6px',
          boxShadow: `0 2px 10px rgba(0,0,0,0.6), 0 0 12px ${rc.color}45, inset 0 1px 0 rgba(255,255,255,0.22)`,
          backdropFilter: 'blur(6px)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8.5px', fontWeight: 800, color: '#f3e8ff', letterSpacing: '0.1em', textTransform: 'uppercase', textShadow: `0 0 8px ${rc.color}` }}>★ LEGENDARY</span>
        </div>
      </div>

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px', zIndex: 18 }}>
        <h3 style={{ margin: '0 0 4px', fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.2px', color: '#faf0d8', textShadow: '0 2px 8px rgba(0,0,0,0.95)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.52)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>DAY {day} · {claimed} PULLED</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', fontWeight: 700, color: '#e9d5ff', background: `${rc.color}28`, border: `1px solid ${rc.color}60`, padding: '1px 7px', borderRadius: '999px', whiteSpace: 'nowrap' }}>{tempo} BPM · {Math.round(energy * 100)} NRG</span>
        </div>
        {mintBar}
        {showAudio && audioUrl && <div style={{ marginTop: '6px' }}><AudioPreview audioUrl={audioUrl} title={title} rarity={card.rarity} /></div>}
        {showClaim && onClaim && (
          <button onClick={e => { e.stopPropagation(); onClaim(); }} style={{ width: '100%', marginTop: '8px', padding: '10px', background: `linear-gradient(135deg, ${rc.color}, ${rc.color}bb)`, color: '#fff', fontWeight: 900, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', border: 0, borderRadius: '6px', cursor: 'pointer', boxShadow: `0 4px 24px ${rc.color}55` }}>
            ★ Claim Legendary
          </button>
        )}
      </div>
      {proof && <ProofSeal type={proof} />}
      {holoLayer}
    </motion.div>
  );

  // ── MYTHIC: Cosmic Aurora, God Rays & Holographic Diffraction ─────────────
  const mythicFront = (
    <motion.div
      style={{
        ...sharedFrontStyle,
        border: `2px solid #ffd700`,
        boxShadow: '0 0 0 1px rgba(255,215,0,0.5), 0 0 25px rgba(255,215,0,0.4)',
      }}
    >
      {/* Background celestial god-rays */}
      <MythicGodRays />

      {/* Art */}
      <div style={{ position: 'absolute', inset: 0, filter: 'brightness(1.1) contrast(1.05)' }}>
        {renderArt('w-full h-full', true)}
      </div>
      {/* Fallback bg */}
      <div style={{ position: 'absolute', inset: 0, background: '#0a0800', zIndex: -1 }} />

      {/* Holographic prism foil sweeps */}
      <MythicPrismFoil />

      {/* Cosmic stardust particle embers */}
      <MythicEmberParticles count={16} />

      <div className="absolute inset-0 scanlines opacity-20 pointer-events-none" />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 26%, transparent 46%, rgba(0,0,0,0.82) 70%, rgba(0,0,0,0.98) 100%)',
        }}
      />

      {/* Top */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 20,
        }}
      >
        <div style={{ transform: 'scale(0.86)', transformOrigin: 'left center' }}>
          <DayNumberBadge day={day} color={rc.color} />
        </div>
        <MythicCrownBadge />
      </div>

      {/* Bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          zIndex: 20,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '18px',
            fontWeight: 900,
            textTransform: 'uppercase',
            color: '#fffbe8',
            textShadow: `0 0 18px ${rc.color}aa, 0 2px 6px rgba(0,0,0,0.9)`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8.5px', fontWeight: 800, color: rc.color, whiteSpace: 'nowrap' }}>
              DAY {day}
            </span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', color: 'rgba(255,215,0,0.75)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              • 1 OF 1 GENESIS
            </span>
          </div>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', fontWeight: 800, color: '#0a0800', background: 'linear-gradient(90deg, #ffd700, #ffaa00)', padding: '1px 7px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
            {tempo} BPM
          </span>
        </div>
        <div style={{ height: '2.5px', background: 'rgba(255,255,255,0.12)', borderRadius: '1px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${mintPct}%`,
              background: `linear-gradient(90deg, #ffd700, #ff007f, #00f0ff, #ffd700)`,
              backgroundSize: '200% 100%',
              animation: 'foil-sweep 3s linear infinite',
              boxShadow: `0 0 8px #ffd700`,
            }}
          />
        </div>
        {showAudio && audioUrl && <AudioPreview audioUrl={audioUrl} title={title} rarity={card.rarity} />}
        {showClaim && onClaim && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClaim();
            }}
            style={{
              width: '100%',
              padding: '10px',
              border: `1px solid ${rc.color}`,
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
              color: '#000',
              fontWeight: 900,
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: `0 4px 20px ${rc.color}80`,
            }}
          >
            ✦ Claim Mythic 1/1
          </button>
        )}
      </div>
      {proof && <ProofSeal type={proof} />}
      {holoLayer}
    </motion.div>
  );

  const frontFace = showBackOnly
    ? renderCardBack(card, activeCardBack)
    : activeCardSkin !== 'original' && !ultraReward
    ? (() => {
        const SkinComponent = getSkinComponent(activeCardSkin);
        return (
          <CardSkinContext.Provider value={{ staticFace: 'front' }}>
            <SkinComponent card={card} />
          </CardSkinContext.Provider>
        );
      })()
    : (
        card.rarity === 'common'    ? commonFront :
        card.rarity === 'uncommon'  ? uncommonFront :
        card.rarity === 'rare'      ? rareFront :
        card.rarity === 'legendary' ? legendaryFront :
        mythicFront
      );

  // ════════════════════════════════════════════════════════════════════════
  // OUTER WRAPPER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.93 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: delay * 0.09, ease: [0.22, 1, 0.36, 1] }}
      className="relative group"
      style={{ perspective: '900px' }}
    >
      <div ref={tiltRef} className="holo-tilt" style={{ borderRadius: '12px' }}>
      <motion.div
        onClick={handleClick}
        style={{
          position: 'relative',
          transformStyle: 'preserve-3d',
          rotateY,
          aspectRatio: '3 / 4',
          cursor: interactive ? 'pointer' : 'default',
          borderRadius: '12px',
        }}
      >
        {frontFace}
        {cornerMedallionsOverlay}
        {dailyOverlay}
        {cardBack}
        {excessOverlay}
        {onlyOneOutline}
        {lastCopyBadge}

        {/* ===== ECHO GLITCH OVERLAY (CRT Scanline & Watermark; badge lives in CardCornerMedallions) ===== */}
        {isEcho && (
          <motion.div
            style={{
              position: 'absolute', inset: 0, zIndex: 35, pointerEvents: 'none', borderRadius: '12px', overflow: 'hidden',
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              visibility: frontVisibility,
            }}
          >
            {/* Chromatic aberration border — RGB split */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '12px',
              boxShadow: `inset 2px 0 0 rgba(255,0,0,0.16), inset -2px 0 0 rgba(0,255,255,0.16), inset 0 2px 0 rgba(0,255,0,0.08)`,
            }} />

            {/* Heavier scanlines */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,170,0.04) 2px, rgba(0,212,170,0.04) 4px)',
              animation: 'echo-scan 3s linear infinite',
            }} />

            {/* Horizontal glitch shift */}
            <div style={{
              position: 'absolute', top: `${30 + (echoGeneration * 10) % 40}%`, left: '-2px', right: '-2px',
              height: '3px', background: 'rgba(0,212,170,0.2)',
              animation: 'echo-glitch-line 2s ease-in-out infinite',
            }} />

            {/* ECHO watermark stamp */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%) rotate(-25deg)',
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: echoGeneration >= 3 ? '28px' : '34px',
              fontWeight: 900,
              color: 'rgba(0,212,170,0.08)',
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}>
              {echoGeneration >= 3 ? 'ENTROPY' : `RE-ENTRY 00${echoGeneration}`}
            </div>
          </motion.div>
        )}
      </motion.div>
      </div>

      {/* Hover glow — legendary/mythic/daily */}
      {(['legendary','mythic'].includes(card.rarity) || isDailyClaim) && interactive && (
        <div
          className="absolute -inset-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
          style={{
            background: `radial-gradient(ellipse at center, ${isDailyClaim ? 'rgba(255,215,0,0.15)' : `${rc.color}22`}, transparent 70%)`,
            filter: 'blur(10px)',
          }}
        />
      )}
    </motion.div>
  );
});
