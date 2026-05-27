import { useState, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { VaultCard } from '../services/vaultService';
import { RARITY_CONFIG, getSupplyCap, type UltraReward, type ProofType } from '../utils/rarity';
import RarityBadge from './RarityBadge';
import AudioPreview from './AudioPreview';
import { formatDate } from '../utils/dayCalc';
import { Gift, Flame, ShieldCheck } from 'lucide-react';

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
}

// Shared stat box primitive
function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '4px 2px',
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '3px',
    }}>
      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '7px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color, lineHeight: 1.1 }}>{value}</span>
    </div>
  );
}

function ProofSeal({ type }: { type: ProofType }) {
  if (!type) return null;
  const isFirst = type === 'proof_of_first';
  const color = isFirst ? '#a78bfa' : '#ef4444';
  const icon = isFirst ? '🔮' : '🎲';
  const label = isFirst ? 'PROOF OF FIRST' : 'HEARD FIRST';
  
  return (
    <div style={{
      position: 'absolute', top: '35%', right: '-8px',
      transform: 'rotate(12deg) translateY(-50%)',
      zIndex: 45,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: '#fff', border: `2.5px solid ${color}`,
        padding: '5px 10px', boxShadow: `3px 3px 0 #000, 0 0 20px ${color}40`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        borderRadius: '2px',
      }}>
        <span style={{ fontSize: '12px' }}>{icon}</span>
        <span style={{ 
          fontFamily: '"Impact", sans-serif', fontSize: '9px', 
          color: '#000', textTransform: 'uppercase', lineHeight: 1,
          marginTop: '1px', letterSpacing: '-0.2px'
        }}>{label}</span>
        <div style={{ 
          width: '100%', height: '1.5px', background: color, 
          margin: '3px 0', opacity: 0.2 
        }} />
        <span style={{ 
          fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', 
          fontWeight: 900, color: '#000', lineHeight: 1
        }}>1 / 1</span>
      </div>
    </div>
  );
}

export default function Card({
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
}: CardProps) {
  const [isFaceDown, setIsFaceDown] = useState(!isRevealed);
  const [imgError, setImgError] = useState(false);
  const [hasFlipped, setHasFlipped] = useState(isRevealed);
  const [realClaimed, setRealClaimed] = useState<number | null>(null);

  const rotateY = useMotionValue(!isRevealed ? 180 : 0);
  const frontVisibility = useTransform(rotateY, v => (Math.abs(v % 360) < 90 || Math.abs(v % 360) > 270 ? 'visible' : 'hidden'));
  const backVisibility  = useTransform(rotateY, v => (Math.abs(v % 360) >= 90 && Math.abs(v % 360) <= 270 ? 'visible' : 'hidden'));

  useEffect(() => {
    import('../services/vaultService').then(({ getClaimedCountForRarity }) => {
      getClaimedCountForRarity(card.day || 0, card.rarity || 'common').then(setRealClaimed);
    });
  }, [card.day, card.rarity]);

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

  if (!card || !card.rarity) return null;

  const rc = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.common;
  const title   = card.title || 'Unknown';
  const day     = card.day || 0;
  const mood    = card.mood || 'dark';
  const energy  = card.energy  ?? 0;
  const valence = card.valence ?? 0;
  const tempo   = card.tempo   ?? 0;
  const supply  = getSupplyCap(card.rarity, card.day);
  const claimed = realClaimed ?? card.claimedCount ?? 0;
  const coverUrl = card.coverUrl || '';
  const audioUrl = card.audioUrl || '';
  const hasArt   = !imgError && coverUrl;

  // Minted-out: true only when THIS specific copy exceeds the supply cap (excess edition)
  // or when no edition prop is given and the rarity pool is fully claimed.
  const isMintedOut = edition !== undefined ? edition > supply : claimed >= supply;

  const mintPct = supply > 0 ? (Math.min(claimed, supply) / supply) * 100 : 0;

  const renderArt = (className = 'w-full h-full', rotated = false) =>
    hasArt ? (
      <img
        src={coverUrl}
        alt={title}
        className={`${className} object-cover`}
        style={{
          ...(rotated ? { transform: 'rotate(90deg) scale(1.35)', transformOrigin: 'center' } : undefined),
          ...(isEcho ? { filter: `grayscale(${Math.min(30 + echoGeneration * 15, 70)}%) contrast(1.15) brightness(0.9)` } : {}),
        }}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    ) : (
      <div className={`${className} flex items-center justify-center`} style={{
        background: `linear-gradient(135deg, ${rc.color}18, #050402, ${rc.color}10)`,
      }}>
        <span style={{ fontFamily: '"Impact", sans-serif', fontSize: '64px', color: `${rc.color}30`, lineHeight: 1 }}>{String(day).padStart(3, '0')}</span>
      </div>
    );

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
    <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${mintPct}%`, background: rc.color, borderRadius: '1px', boxShadow: `0 0 6px ${rc.color}88` }} />
    </div>
  );

  // ── Daily overlay — gated to front face only ────────────────────────────
  const dailyOverlay = (isDailyClaim || isDailyOrigin) && (
    <motion.div
      style={{
        position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none', borderRadius: '12px', overflow: 'hidden',
        backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
        rotateY: 0, visibility: frontVisibility,
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, padding: '6px 10px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.85), transparent)',
        borderTop: '2px solid rgba(255,215,0,0.45)',
        display: 'flex', alignItems: 'center', gap: '5px',
      }}>
        <Gift size={11} style={{ color: '#ffd700' }} />
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>Daily Drop</span>
      </div>
      <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,215,0,0.25)', borderRadius: '12px', boxShadow: 'inset 0 0 20px rgba(255,215,0,0.06)' }} />
    </motion.div>
  );


  // ── Minted out overlay — only shown when this copy is an excess edition ────
  const mintedOutOverlay = isMintedOut && (
    <motion.div
      style={{
        position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none', borderRadius: '12px',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'grayscale(1) contrast(1.1)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '20px',
        visibility: frontVisibility,
      }}
    >
      {/* MINTED OUT stamp */}
      <div style={{
        padding: '6px 14px', border: '3px solid #ff3800', color: '#ff3800',
        fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '22px',
        fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px',
        transform: 'rotate(-12deg)', background: 'rgba(0,0,0,0.9)',
        boxShadow: '0 0 24px rgba(255,56,0,0.5)',
        textShadow: '0 0 12px rgba(255,56,0,0.8)',
      }}>
        MINTED OUT
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
          title="Burn for V⚡ tokens"
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
      {[{t:true,l:true},{t:true,l:false},{t:false,l:true},{t:false,l:false}].map(({t,l},i) => (
        <div key={i} style={{ position: 'absolute', width: '14px', height: '14px', top: t ? '16px' : undefined, bottom: !t ? '16px' : undefined, left: l ? '16px' : undefined, right: !l ? '16px' : undefined, borderTop: t ? '1px solid rgba(255,215,0,0.3)' : 'none', borderBottom: !t ? '1px solid rgba(255,215,0,0.3)' : 'none', borderLeft: l ? '1px solid rgba(255,215,0,0.3)' : 'none', borderRight: !l ? '1px solid rgba(255,215,0,0.3)' : 'none' }} />
      ))}
    </motion.div>
  ) : (
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
      <div style={{ position: 'absolute', inset: 0, background: '#0c0a07' }} />

      {/* Rarity-tinted radial */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 40%, ${rc.color}14, transparent 65%)` }} />

      {/* Diamond grid SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.055 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`bp-${day}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M11 0L22 11L11 22L0 11Z" fill="none" stroke={rc.color} strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#bp-${day})`} />
      </svg>

      {/* Inner double frame */}
      <div style={{ position: 'absolute', inset: '12px', border: `1px solid ${rc.color}22`, borderRadius: '8px' }}>
        <div style={{ position: 'absolute', inset: '6px', border: `1px solid ${rc.color}10`, borderRadius: '5px' }}>

          {/* Centre emblem */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>

            {/* V mark */}
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '68px', height: '68px', borderRadius: '14px',
                background: `linear-gradient(145deg, ${rc.color}18, transparent)`,
                border: `2px solid ${rc.color}30`,
                boxShadow: `0 0 30px ${rc.color}10, inset 0 0 16px ${rc.color}05`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '32px', fontWeight: 900, color: rc.color, textShadow: `0 0 18px ${rc.color}60` }}>V</span>
              </div>
              {['rare','legendary','mythic'].includes(card.rarity) && (
                <div style={{ position: 'absolute', inset: '-10px', borderRadius: '24px', background: `radial-gradient(circle, ${rc.color}12, transparent 70%)`, animation: 'pulse-glow 3s ease-in-out infinite' }} />
              )}
            </div>

            {/* Branding */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase', color: rc.color, textShadow: `0 0 10px ${rc.color}40` }}>
                th3v4ult
              </span>
              <div style={{ width: '40px', height: '1px', background: `${rc.color}30` }} />
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,240,216,0.35)' }}>
                GEN 0 {isEcho ? `· RE-ENTRY 00${echoGeneration}` : ''} · {card.rarity.toUpperCase()}
              </span>
            </div>

            {/* Day pill */}
            <div style={{ padding: '4px 14px', border: `1px solid ${rc.color}22`, borderRadius: '20px', background: `${rc.color}06` }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: rc.color }}>
                #{String(day).padStart(3, '0')}
              </span>
            </div>

            {/* Mythic CTA */}
            {card.rarity === 'mythic' && interactive && (
              <a href={`https://th3scr1b3.art/stems/${day}`} target="_blank" rel="noreferrer"
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
              borderTop:    t ? `1px solid ${rc.color}25` : 'none',
              borderBottom: !t ? `1px solid ${rc.color}25` : 'none',
              borderLeft:   l ? `1px solid ${rc.color}25` : 'none',
              borderRight:  !l ? `1px solid ${rc.color}25` : 'none',
            }} />
          ))}
        </div>
      </div>

      {/* Scanlines for rare+ */}
      {['rare','legendary','mythic'].includes(card.rarity) && (
        <div className="absolute inset-0 scanlines opacity-[0.12]" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } as React.CSSProperties} />
      )}

      {/* Outer rarity border — static only, NO animated box-shadow here.
          Animated CSS classes (legendary-glow, mythic-pulse) cause GPU
          compositing artifacts inside a preserve-3d container. */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '12px', opacity: 0.6,
        border: `1.5px solid ${rc.color}55`,
        pointerEvents: 'none',
        backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
      } as React.CSSProperties} />
    </motion.div>
  );

  // ════════════════════════════════════════════════════════════════════════
  // FRONT FACES
  // ════════════════════════════════════════════════════════════════════════

  const sharedFrontStyle = {
    position: 'absolute' as const, inset: 0, borderRadius: '12px', overflow: 'hidden',
    backfaceVisibility: 'hidden' as const, WebkitBackfaceVisibility: 'hidden' as const,
    visibility: frontVisibility,
    rotateY: 0,
    willChange: 'transform' as const,
  };

  // ── COMMON: Bold editorial / press-stamp ─────────────────────────────
  const commonFront = (
    <motion.div style={{ ...sharedFrontStyle, background: '#0c0a07', border: `1.5px solid ${rc.color}50` }}>
      {/* Top strip */}
      <div style={{ padding: '6px 10px', borderBottom: `1px solid ${rc.color}20`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${rc.color}08`, flexShrink: 0 }}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', fontWeight: 700, color: rc.color }}>#{String(day).padStart(3, '0')}</span>
        <RarityBadge rarity={card.rarity} size="sm" />
      </div>

      {/* Art — 46% keeps info breathing room */}
      <div style={{ position: 'relative', height: '46%', flexShrink: 0, borderBottom: `1px solid ${rc.color}20`, overflow: 'hidden' }}>
        {renderArt('w-full h-full')}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.5) 100%)' }} />
      </div>

      {/* Info */}
      <div style={{ padding: '6px 10px 8px', display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, overflow: 'hidden' }}>
        {/* Rule */}
        <div style={{ height: '1.5px', background: `linear-gradient(90deg, ${rc.color}60, transparent)`, flexShrink: 0 }} />
        <h3 style={{ margin: 0, fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.3px', color: '#faf0d8', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          {[
            {label:'NRG', value: Math.round(energy * 100)},
            {label:'VAL', value: Math.round(valence * 100)},
            {label:'BPM', value: tempo},
            {label: mood === 'light' ? 'LGT' : 'DRK', value: mood === 'light' ? '☀' : '🌙'},
          ].map(s => <div key={s.label} style={{ flex: 1 }}><StatBox label={s.label} value={s.value} color={rc.color} /></div>)}
        </div>
        <div style={{ flexShrink: 0 }}>{mintBar}</div>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '7px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', flexShrink: 0, lineHeight: 1 }}>{claimed} PULLED · {day > 0 ? formatDate(day) : ''}</span>
        {showAudio && audioUrl && <div style={{ flexShrink: 0 }}><AudioPreview audioUrl={audioUrl} title={title} rarity={card.rarity} /></div>}
        {claimBtn}
        {proof && <ProofSeal type={proof} />}
      </div>
    </motion.div>
  );

  // ── UNCOMMON: Glossy laminate frame ──────────────────────────────────
  const uncommonFront = (
    <motion.div style={{ ...sharedFrontStyle, background: '#0c0a07', border: `2px solid ${rc.color}60` }}>
      {/* Gloss sheen */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 25%, rgba(255,255,255,0.07) 40%, rgba(255,255,255,0.13) 50%, transparent 58%)', pointerEvents: 'none', zIndex: 10 }} />

      {/* Art — larger crop */}
      <div style={{ position: 'relative', height: '62%', overflow: 'hidden', borderBottom: `1.5px solid ${rc.color}40` }}>
        {renderArt('w-full h-full')}
        {/* Day badge */}
        <div style={{ position: 'absolute', top: '8px', left: '8px', padding: '3px 8px', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', border: `1px solid ${rc.color}40`, borderRadius: '3px' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>#{String(day).padStart(3, '0')}</span>
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
      </div>

      {/* Info strip */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 style={{ margin: 0, fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.3px', color: '#faf0d8', lineHeight: 1.05, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h3>
          <div style={{ marginLeft: '6px', flexShrink: 0 }}><RarityBadge rarity={card.rarity} size="sm" /></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '9px', fontFamily: '"JetBrains Mono", monospace', color: rc.color, alignItems: 'center' }}>
          <span>{Math.round(energy * 100)} NRG</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>{tempo} BPM</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>{mood === 'light' ? '☀ Light' : '🌙 Dark'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '7px', color: 'rgba(255,255,255,0.2)', minWidth: '60px' }}>{claimed} PULLED</span>
          <div style={{ flex: 1 }}>{mintBar}</div>
        </div>
        {showAudio && audioUrl && <AudioPreview audioUrl={audioUrl} title={title} rarity={card.rarity} />}
        {claimBtn}
        {proof && <ProofSeal type={proof} />}
      </div>
    </motion.div>
  );

  // ── RARE: Full-bleed glassmorphism ────────────────────────────────────
  const rareFront = (
    <motion.div style={{ ...sharedFrontStyle, border: `1.5px solid ${rc.color}70` }}>
      {/* Full bleed art */}
      <div style={{ position: 'absolute', inset: 0 }}>{renderArt('w-full h-full')}</div>
      {/* Tinted overlay */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 35%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.92) 100%)` }} />
      {/* Blue tint */}
      <div style={{ position: 'absolute', inset: 0, background: `${rc.color}08`, pointerEvents: 'none' }} />

      {/* Day */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', padding: '4px 10px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', border: `1px solid ${rc.color}40`, borderRadius: '4px' }}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>#{String(day).padStart(3, '0')}</span>
      </div>
      <div style={{ position: 'absolute', top: '10px', right: '10px' }}><RarityBadge rarity={card.rarity} size="sm" /></div>

      {/* Glass info drawer */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderTop: `1px solid rgba(255,255,255,0.12)` }}>
        <h3 style={{ margin: '0 0 4px', fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '19px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.3px', color: '#faf0d8', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>{title}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{claimed} PULLED · {mood === 'light' ? '☀' : '🌙'} {mood}</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', color: rc.color }}>{tempo} BPM</span>
        </div>
        {mintBar}
        {showAudio && audioUrl && <div style={{ marginTop: '6px' }}><AudioPreview audioUrl={audioUrl} title={title} rarity={card.rarity} /></div>}
        {claimBtn}
        {proof && <ProofSeal type={proof} />}
      </div>
    </motion.div>
  );

  // ── LEGENDARY: Foil + gradient ────────────────────────────────────────
  const legendaryFront = (
    <motion.div style={{ ...sharedFrontStyle, border: `2px solid ${rc.color}80` }}>
      {/* Art */}
      <div style={{ position: 'absolute', inset: 0 }}>{renderArt('w-full h-full', true)}</div>

      {/* Foil wash — diagonal rainbow, seamless loop */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(125deg, rgba(255,215,0,0.12) 0%, rgba(255,0,180,0.1) 25%, rgba(0,200,255,0.1) 50%, rgba(160,0,255,0.12) 75%, rgba(255,215,0,0.12) 100%)', backgroundSize: '300% 100%', animation: 'foil-sweep 4s linear infinite', opacity: 0.9 }} />

      {/* Gloss band */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, transparent 28%, rgba(255,255,255,0.18) 42%, rgba(255,255,255,0.04) 52%, transparent 62%)', pointerEvents: 'none' }} />

      {/* Gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 50%, rgba(0,0,0,0.72) 75%, rgba(0,0,0,0.96) 100%)' }} />

      {/* Top badges */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ padding: '3px 9px', background: `${rc.color}30`, border: `1px solid ${rc.color}70`, borderRadius: '3px' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', fontWeight: 700, color: rc.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>★ LEGENDARY</span>
        </div>
        <div style={{ padding: '3px 8px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>#{String(day).padStart(3, '0')}</span>
        </div>
      </div>

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px' }}>
        <h3 style={{ margin: '0 0 3px', fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.3px', color: '#faf0d8', textShadow: '0 2px 8px rgba(0,0,0,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h3>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Day {day} · {claimed} PULLED</span>
        </div>
        {mintBar}
        {showAudio && audioUrl && <div style={{ marginTop: '6px' }}><AudioPreview audioUrl={audioUrl} title={title} rarity={card.rarity} /></div>}
        {showClaim && onClaim && (
          <button onClick={e => { e.stopPropagation(); onClaim(); }} style={{ width: '100%', marginTop: '8px', padding: '10px', background: `linear-gradient(135deg, ${rc.color}, ${rc.color}bb)`, color: '#fff', fontWeight: 900, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', border: 0, borderRadius: '6px', cursor: 'pointer', boxShadow: `0 4px 24px ${rc.color}55` }}>
            ★ Claim Legendary
          </button>
        )}
        {proof && <ProofSeal type={proof} />}
      </div>
    </motion.div>
  );

  // ── MYTHIC: Rainbow foil, no CSS Houdini ─────────────────────────────
  const mythicFront = (
    <motion.div style={{ ...sharedFrontStyle, border: `2px solid #ffd700`, boxShadow: '0 0 0 1px rgba(255,215,0,0.4), 0 0 20px rgba(255,215,0,0.3)' }}>
      {/* Art */}
      <div style={{ position: 'absolute', inset: 0, filter: 'brightness(1.1)' }}>{renderArt('w-full h-full', true)}</div>
      {/* Fallback bg */}
      <div style={{ position: 'absolute', inset: 0, background: '#0a0800', zIndex: -1 }} />

      {/* Rainbow foil #1 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(120deg, rgba(255,0,120,0.17) 0%, rgba(255,180,0,0.2) 25%, rgba(0,255,160,0.16) 50%, rgba(60,0,255,0.2) 75%, rgba(255,0,120,0.17) 100%)', backgroundSize: '300% 100%', animation: 'foil-sweep 3s linear infinite' }} />
      {/* Rainbow foil #2 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(60deg, rgba(0,200,255,0.12) 0%, rgba(255,80,0,0.16) 33%, rgba(180,0,255,0.12) 66%, rgba(0,200,255,0.12) 100%)', backgroundSize: '200% 100%', animation: 'foil-sweep 2s linear infinite reverse', opacity: 0.85 }} />

      <div className="absolute inset-0 scanlines opacity-25 pointer-events-none" />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.68) 0%, transparent 28%, transparent 46%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0.97) 100%)' }} />

      {/* Top */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ padding: '3px 8px', background: 'rgba(0,0,0,0.85)', border: `1px solid ${rc.color}90`, borderRadius: '3px', boxShadow: `0 0 10px ${rc.color}40` }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', fontWeight: 700, color: rc.color }}>#{String(day).padStart(3, '0')}</span>
        </div>
        <div style={{ padding: '3px 9px', background: `${rc.color}22`, border: `1px solid ${rc.color}`, borderRadius: '3px', boxShadow: `0 0 14px ${rc.color}55` }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', fontWeight: 900, letterSpacing: '0.15em', color: rc.color, textShadow: `0 0 8px ${rc.color}`, textTransform: 'uppercase' }}>✦ MYTHIC</span>
        </div>
      </div>

      {/* Bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <h3 style={{ margin: 0, fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#fffbe8', textShadow: `0 0 18px ${rc.color}aa, 0 2px 6px rgba(0,0,0,0.9)`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', fontWeight: 700, color: rc.color }}>DAY {day}</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', color: 'rgba(255,215,0,0.4)' }}>• 1 OF {supply}</span>
        </div>
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.1)', borderRadius: '1px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${mintPct}%`, background: `linear-gradient(90deg, ${rc.color}, #ffcc00)`, boxShadow: `0 0 6px ${rc.color}` }} />
        </div>
        {showAudio && audioUrl && <AudioPreview audioUrl={audioUrl} title={title} rarity={card.rarity} />}
        {showClaim && onClaim && (
          <button onClick={e => { e.stopPropagation(); onClaim(); }} style={{ width: '100%', padding: '10px', border: `1px solid ${rc.color}`, borderRadius: '6px', background: rc.color, color: '#000', fontWeight: 900, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: `0 4px 20px ${rc.color}80` }}>
            ✦ Claim Mythic
          </button>
        )}
        {proof && <ProofSeal type={proof} />}
      </div>
    </motion.div>
  );

  const frontFace =
    card.rarity === 'common'    ? commonFront :
    card.rarity === 'uncommon'  ? uncommonFront :
    card.rarity === 'rare'      ? rareFront :
    card.rarity === 'legendary' ? legendaryFront :
    mythicFront;

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
        {dailyOverlay}
        {cardBack}
        {mintedOutOverlay}

        {/* ===== ECHO GLITCH OVERLAY ===== */}
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
              boxShadow: `inset 2px 0 0 rgba(255,0,0,0.15), inset -2px 0 0 rgba(0,255,255,0.15), inset 0 2px 0 rgba(0,255,0,0.08)`,
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

            {/* Generation badge — top right */}
            <div style={{
              position: 'absolute', top: '8px', right: '8px',
              padding: '2px 7px',
              background: 'rgba(0,0,0,0.75)',
              border: '1px solid rgba(0,212,170,0.4)',
              borderRadius: '3px',
              backdropFilter: 'blur(4px)',
            }}>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '8px', fontWeight: 700,
                letterSpacing: '0.1em',
                color: echoGeneration >= 3 ? 'rgba(255,255,255,0.3)' : '#00d4aa',
                textTransform: 'uppercase',
              }}>
                ◎ RE-ENTRY {echoGeneration}
              </span>
            </div>
          </motion.div>
        )}
      </motion.div>

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
}
