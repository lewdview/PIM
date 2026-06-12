import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, animate, AnimatePresence, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, Users, Info, X } from 'lucide-react';
import {
  PACK_CONFIGS, PACK_CAROUSEL_ORDER,
  type PackCategory, type PackSize,
  ROLL_RATES, PROOF_RATES, RARITY_CONFIG,
  type Rarity
} from '../utils/rarity';
import { hasClaimedFreePackToday } from '../services/vaultService';
import { getTimeUntilNextDay } from '../utils/dayCalc';
import { useVaultStore } from '../store/useVaultStore';
import { getAdminConfig } from '../utils/adminConfig';

interface PackShopProps {
  onPurchase: (category: PackCategory, size: PackSize) => void;
}

const CARD_W = 280;
const GAP = 16;
const SLIDE = CARD_W + GAP;

type RipPhase = 'idle' | 'spotlight' | 'tearing' | 'cards_fly' | 'done';

// ===== PACK EMBLEM (Custom Icon) =====
function PackEmblem({ accent, size = 80 }: { accent: string; size?: number }) {
  return (
    <div className="relative flex justify-center items-center my-2 rounded-full mx-auto" style={{ width: size, height: size, boxShadow: `0 0 30px ${accent}20` }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ animation: 'spin-slow 16s linear infinite', transformOrigin: 'center', willChange: 'transform' }}>
        <path id="circlePath" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" fill="transparent" />
        <text fill={accent} fontWeight="bold" style={{ textTransform: 'uppercase', fontSize: '8.5px', textShadow: `0 0 10px ${accent}60`, letterSpacing: '1px' }}>
          <textPath href="#circlePath" startOffset="0%">
            TH3SCR1B3 •  GEN 0  •
          </textPath>
          <textPath href="#circlePath" startOffset="50%">
            TH3SCR1B3 •  GEN 0  •
          </textPath>
        </text>
        <circle cx="50" cy="50" r="23" fill="none" stroke={accent} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-black" style={{ 
          fontSize: size * 0.45, 
          color: '#fff', 
          fontFamily: '"Impact", "Arial Black", sans-serif',
          letterSpacing: '-1.5px',
          transform: 'scaleY(1.2) scaleX(0.9)',
          WebkitTextStroke: '1px #000',
          textShadow: `0 0 10px ${accent}, 2px 2px 0 #000`,
        }}>
          365
        </span>
      </div>
    </div>
  );
}

// ===== RIP TAB =====
function RipTab({ onRip, accent, disabled, labelOverride }: { onRip: () => void; accent: string; disabled?: boolean; labelOverride?: string }) {
  const dragX = useMotionValue(0);
  const [isRipped, setIsRipped] = useState(false);
  const [maxX, setMaxX] = useState(220);
  const ref = useRef<HTMLDivElement>(null);

  const handleDragEnd = useCallback(() => {
    if (disabled) return;
    if (dragX.get() > maxX * 0.55) {
      setIsRipped(true);
      animate(dragX, maxX, { duration: 0.15 });
      setTimeout(() => {
        onRip();
        setTimeout(() => { setIsRipped(false); animate(dragX, 0, { duration: 0.3 }); }, 1500);
      }, 200);
    } else {
      animate(dragX, 0, { type: 'spring', stiffness: 500, damping: 30 });
    }
  }, [dragX, maxX, onRip, disabled]);

  return (
    <div
      ref={ref}
      className="relative h-14 rounded-2xl overflow-hidden select-none"
      style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${accent}25`, backdropFilter: 'blur(10px)' }}
      onPointerDown={() => { if (ref.current) setMaxX(ref.current.offsetWidth - 56); }}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-xs font-bold tracking-[0.25em] uppercase text-center leading-tight px-4"
          style={{ color: `${accent}60`, whiteSpace: 'nowrap' }}>
          {labelOverride ? labelOverride : isRipped ? 'RIPPING...' : 'SLIDE TO RIP'}
        </span>
      </div>
      <motion.div
        drag={disabled ? false : 'x'}
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0.02}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className="absolute left-1.5 top-1.5 bottom-1.5 w-12 z-10 cursor-grab active:cursor-grabbing"
        whileTap={{ scale: 0.92 }}
      >
        <div className="w-full h-full rounded-xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 2px 15px ${accent}50` }}>
          <ChevronRight size={18} color="#000" strokeWidth={3} />
        </div>
      </motion.div>
    </div>
  );
}

// ===== FOIL PACK BAG =====
function PackBag({ category, isActive, onRip, isRipping, isFreeClaimed }: {
  category: PackCategory; isActive: boolean; isRipping: boolean; isFreeClaimed?: boolean;
  onRip: (cat: PackCategory, size: PackSize) => void;
}) {
  const [tierIdx, setTierIdx] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [rippedCount, setRippedCount] = useState<number>(0);

  const cfg = PACK_CONFIGS[category];
  const accent = cfg.accent;
  const tier = cfg.tiers[tierIdx];
  const isSpecial = category === 'prophecy' || category === 'alpha';
  const isFreeDisabled = category === 'free' && isFreeClaimed;

  useEffect(() => {
    import('../services/vaultService').then(({ getPackRipCount }) => {
      getPackRipCount(category).then(setRippedCount);
    });
  }, [category]);
  const limits = useVaultStore((s) => s.dailyLimits);
  let isOverLimit = false;
  let limitLabel = '';

  const adminCfg = getAdminConfig();
  const maxStandard = adminCfg.dailyStandardLimit || 30;
  const maxPremium = adminCfg.dailyPremiumLimit || 2;

  if (category !== 'free' && category !== 'vault_token') {
    if (isSpecial) {
      if (limits.premium + tier.cardCount > maxPremium) {
        isOverLimit = true;
        limitLabel = `Daily Limit Reached (${limits.premium}/${maxPremium})`;
      }
    } else {
      if (limits.standard + tier.cardCount > maxStandard) {
        isOverLimit = true;
        limitLabel = `Daily Limit Reached (${limits.standard}/${maxStandard})`;
      }
    }
  }

  const tokenBalance = useVaultStore((s) => s.tokenBalance);
  const tokenPackCost = adminCfg.tokenPackCost ?? 275;
  const isVaultToken = category === 'vault_token';
  const hasEnoughTokens = !isVaultToken || (tokenBalance >= tokenPackCost);

  const disabledAction = isRipping || !isActive || isFreeDisabled || isOverLimit || (isVaultToken && !hasEnoughTokens);

  // Countdown timer for free pack cooldown
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!isFreeDisabled) { setCountdown(''); return; }
    const tick = () => {
      const t = getTimeUntilNextDay();
      setCountdown(`NEXT FREE IN ${t.hours}H ${String(t.minutes).padStart(2, '0')}M ${String(t.seconds).padStart(2, '0')}S`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isFreeDisabled]);

  let dynamicLabelOverride = '';
  if (isFreeDisabled) dynamicLabelOverride = countdown || 'CLAIMED TODAY';
  else if (isOverLimit) dynamicLabelOverride = limitLabel;
  else if (isVaultToken && !hasEnoughTokens) dynamicLabelOverride = `NEED ${tokenPackCost} V⚡`;

  const repeatedText = Array(5).fill(0).map(() => `365 DAYS OF LIGHT AND DARK \u2022 ${cfg.label}`).join(' \u2022 ');

  return (
    <div className="flex-shrink-0 flex flex-col items-center" style={{ width: `${CARD_W}px` }}>
      {/* Inline styles for scrolling the brutalist text */}
      <style>{`
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-up {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes breathe-opacity {
          0%, 100% { opacity: 0.05; }
          50% { opacity: 0.35; }
        }
        @keyframes breathe-opacity-subtle {
          0%, 100% { opacity: 0.02; }
          50% { opacity: 0.15; }
        }
        @keyframes spin-slow {
          100% { transform: rotate(360deg); }
        }
        @keyframes spin-slow {
          100% { transform: rotate(360deg); }
        }
        .sale-burst {
          clip-path: polygon(
            50% 0%, 63% 4%, 74% 1%, 82% 10%, 93% 8%, 97% 20%, 100% 31%, 97% 42%, 100% 53%, 97% 64%, 100% 75%, 93% 84%, 97% 95%, 86% 97%, 75% 100%, 64% 97%, 53% 100%, 42% 97%, 31% 100%, 22% 93%, 11% 97%, 5% 86%, 0% 75%, 3% 64%, 0% 53%, 3% 42%, 0% 31%, 7% 22%, 3% 11%, 14% 5%, 25% 0%, 36% 3%
          );
        }
        /* Inline price-sticker-gun only used in RipOverlay */
        .price-sticker-gun {
          position: relative;
          color: #000000;
          box-shadow: 2px 2px 0 rgba(0,0,0,0.2), inset 0 0 3px rgba(255,255,255,1);
          padding: 4px 8px;
          min-width: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: "Courier New", Courier, monospace;
          border-radius: 1px;
          /* Scalloped edges effect using mask */
          mask-image: radial-gradient(circle at 50% -2px, transparent 4px, black 5px), 
                      radial-gradient(circle at 50% calc(100% + 2px), transparent 4px, black 5px);
          mask-size: 10px 100%;
          mask-repeat: repeat-x;
        }
        .sticker-slits::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, var(--slit-color, rgba(0,0,0,0.1)) 10.5px, transparent 11px);
          pointer-events: none;
        }
        /* Bold price stamp for pack bags */
        .pack-price-stamp {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          color: #000000;
          border: 3px solid #000;
          padding: 5px 12px 4px;
          border-radius: 2px;
          font-family: 'Impact', 'Arial Black', sans-serif;
          box-shadow: 4px 4px 0 #000;
          min-width: 72px;
        }
        .pack-price-stamp::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0,0,0,0.055) 5.5px, transparent 6px);
          pointer-events: none;
        }
      `}</style>
      <div className="relative w-full overflow-hidden" style={{
        aspectRatio: '3 / 4.5',
        borderRadius: '8px 8px 12px 12px',
        WebkitMaskImage: '-webkit-radial-gradient(white, black)', // Forces Chrome/Safari to respect border-radius clipping
        background: cfg.gradient,
        boxShadow: isActive ? `0 20px 60px rgba(0,0,0,0.6), 0 0 30px ${accent}40, inset 0 0 25px rgba(255,255,255,0.3)` : '0 10px 30px rgba(0,0,0,0.3)',
        transform: isActive ? 'scale(1)' : 'scale(0.85)',
        opacity: isActive ? 1 : 0.4,
        transition: 'transform 0.35s cubic-bezier(.22,1,.36,1), opacity 0.35s ease, box-shadow 0.35s ease',
      }}>
        {/* FOIL CRIMP BORDERS (Top & Bottom edges) */}
        <div className="absolute inset-x-0 top-0 h-[14px] crimp-edge z-10" style={{
          boxShadow: '0 3px 6px rgba(0,0,0,0.4)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
        }} />
        <div className="absolute inset-x-0 bottom-0 h-[14px] crimp-edge z-10" style={{
          boxShadow: '0 -3px 6px rgba(0,0,0,0.4)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
        }} />

        {/* METALLIC NOISE TEXTURE */}
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay" style={{
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          opacity: 0.15,
          zIndex: 1,
        }} />

        {/* VERTICAL TH3SCR1B3 SIDE BANNER */}
        <div className="absolute left-0 bottom-12 w-8 flex items-center justify-center pointer-events-none z-20 mix-blend-overlay">
          <div className="font-black leading-none uppercase whitespace-nowrap" style={{
            transform: 'rotate(-90deg) scaleY(1.3) scaleX(0.9)',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '18px',
            letterSpacing: '-1.5px',
            WebkitTextStroke: `1px ${accent}`,
            textShadow: `0 0 12px ${accent}70`,
          }}>
            TH3SCR1B3
          </div>
        </div>

        {/* TOP-LEFT: Bold Price Stamp */}
        <div className="absolute left-3 top-3 z-30 pointer-events-none">
          {/* Price Stamp */}
          <div
            className="pack-price-stamp"
            style={{
              '--stamp-stripe': `${accent}15`,
              transform: 'rotate(-2.5deg)',
            } as any}
          >
            <span style={{ fontSize: '7px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.5, lineHeight: 1, marginBottom: 2 }}>
              PRICE
            </span>
            <span style={{ fontSize: '28px', lineHeight: 1, letterSpacing: '-1.5px', fontFamily: '"Impact", "Arial Black", sans-serif', transform: 'scaleY(1.18)', transformOrigin: 'center', display: 'block', fontWeight: 900 }}>
              {tier.price === 'FREE' ? 'FREE' : tier.price}
            </span>
            <span style={{ fontSize: '7px', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', opacity: 0.4, marginTop: 1, textTransform: 'uppercase' }}>
              {tier.price === 'FREE' ? 'no cost' : 'per pack'}
            </span>
          </div>

        </div>

        {/* BOTTOM-RIGHT: Card Count Stamp */}
        <div className="absolute right-3 bottom-16 z-30 pointer-events-none">
          <div
            className="pack-price-stamp"
            style={{
              '--stamp-stripe': `${accent}15`,
              transform: 'rotate(1.5deg)',
              padding: '3px 10px',
              minWidth: '60px',
              boxShadow: '3px 3px 0 #000',
            } as any}
          >
            <span style={{ fontSize: '6px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.5, lineHeight: 1, marginBottom: 1 }}>
              CONTENTS
            </span>
            <span style={{ fontSize: '18px', lineHeight: 1, letterSpacing: '-1px', fontFamily: '"Impact", "Arial Black", sans-serif', transform: 'scaleY(1.18)', transformOrigin: 'center', display: 'block', fontWeight: 900 }}>
              {tier.cardCount}{tier.cardCount === 1 ? '' : '×'}
            </span>
            <span style={{ fontSize: '6px', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', opacity: 0.4, marginTop: 1, textTransform: 'uppercase' }}>
              {tier.cardCount === 1 ? 'pack' : 'cards'}
            </span>
          </div>
        </div>

        {/* Hardware-accelerated base glow */}
        <div className="absolute inset-0 opacity-60 mix-blend-screen pointer-events-none" style={{
          background: `radial-gradient(ellipse at 50% 15%, ${accent}40, transparent 50%), radial-gradient(ellipse at 50% 85%, ${accent}30, transparent 50%)`,
          zIndex: 0,
        }} />

        {/* BRUTALIST SCROLLING TEXT - Staggered Breathing Container */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none mix-blend-overlay" style={{ zIndex: 1 }}>
          
          {/* Horizontal scroll 1 (Top) */}
          <div className="absolute top-10 left-0 right-0 whitespace-nowrap" style={{ 
            width: '200%', display: 'flex',
            animation: isActive ? 'breathe-opacity 6s ease-in-out infinite' : 'none',
            opacity: 0.2, // fallback
          }}>
            <div className="pack-marquee-text" style={{ animation: isActive ? 'scroll-left 40s linear infinite' : 'none', fontSize: '6rem', lineHeight: 1, '--neon-accent': '#ffffff' } as any}>
              {repeatedText}
            </div>
          </div>

          {/* Horizontal scroll 2 (Bottom, Reverse) */}
          <div className="absolute bottom-10 right-0 whitespace-nowrap flex justify-end" style={{ 
            width: '200%',
            animation: isActive ? 'breathe-opacity 6s ease-in-out infinite' : 'none',
            animationDelay: isActive ? '-2s' : '0s',
            opacity: 0.2, // fallback
          }}>
            <div className="pack-marquee-text" style={{ animation: isActive ? 'scroll-left 30s linear infinite reverse' : 'none', fontSize: '4.5rem', lineHeight: 1, '--neon-accent': '#ffffff' } as any}>
              {repeatedText}
            </div>
          </div>

          {/* Vertical scroll (Centered) */}
          <div className="absolute inset-0 flex justify-center pointer-events-none mix-blend-overlay" style={{
            animation: isActive ? 'breathe-opacity-subtle 6s ease-in-out infinite' : 'none',
            animationDelay: isActive ? '-4s' : '0s',
            opacity: 0.1, // fallback
          }}>
            <div style={{ height: '200%', display: 'flex', flexDirection: 'column' }}>
              <div className="pack-marquee-text" style={{ 
                writingMode: 'vertical-rl', 
                animation: isActive ? 'scroll-up 24s linear infinite' : 'none', 
                fontSize: '5rem', 
                lineHeight: 1, 
                '--neon-accent': '#ffffff' 
              } as any}>
                {repeatedText}
              </div>
            </div>
          </div>
        </div>



        <div className="relative flex flex-col items-center justify-between h-full pt-[22px] pb-[52px] px-5 z-10">
          <div className="flex items-center justify-end w-full h-8 px-1 opacity-0">
            {/* Cards count placeholder area, now handled by sticker in top-left */}
          </div>

          {/* Top Tier Circles */}
          {cfg.tiers.length > 1 && (
            <div className="flex items-center justify-center gap-3 w-full mt-2">
              {cfg.tiers.map((t, i) => (
                <button 
                  key={t.size} 
                  onClick={() => setTierIdx(i)}
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black font-mono transition-all hover:scale-110 active:scale-95"
                  style={{
                    background: i === tierIdx ? `${accent}cc` : 'rgba(0,0,0,0.6)',
                    color: i === tierIdx ? '#000' : 'var(--color-text-primary)',
                    border: `2px solid ${i === tierIdx ? accent : 'rgba(255,255,255,0.2)'}`,
                    boxShadow: i === tierIdx ? `0 0 15px ${accent}60` : '0 4px 10px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {t.cardCount}×
                </button>
              ))}
            </div>
          )}

          <div className="text-center space-y-2">
            <h3 className="text-[48px] leading-[0.88] pack-label-neon uppercase font-black" style={{
              '--neon-accent': accent,
              color: '#ffffff',
              fontFamily: '"Impact", "Arial Black", sans-serif',
              letterSpacing: '-0.02em',
              transform: 'scaleY(1.3) scaleX(0.9)',
              transformOrigin: 'center',
              WebkitTextStroke: '2px #000000',
              textShadow: `
                0 0 20px ${accent}, 
                0 0 40px ${accent}80, 
                3px 5px 0 #000000, 
                4px 10px 20px rgba(0,0,0,0.95)
              `,
              margin: '16px 0 12px 0',
            } as React.CSSProperties}>
              {cfg.label}
            </h3>
            
            <div className="flex justify-center">
              <PackEmblem accent={accent} size={85} />
            </div>

            <div className="text-center mt-3">
              <div className="inline-block">
                <div className="sticker-gun-tag sticker-slits drop-shadow-md" style={{
                  background: '#ffffff',
                  border: `1.5px solid ${accent}40`,
                  '--slit-color': `${accent}22`,
                  padding: '4px 12px',
                  transform: 'rotate(0.5deg)',
                  minWidth: '170px'
                } as any}>
                  <span className="text-[9px] font-black tracking-tighter uppercase italic opacity-90" style={{ color: '#000' }}>
                    365 DAYS OF LIGHT AND DARK
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] font-mono mt-4" style={{ color: 'var(--color-text-muted)' }}>
              {cfg.description}
            </p>
          </div>

          {isSpecial && (
            <div className="px-3 py-1.5 rounded-lg" style={{ background: `${accent}10`, border: `1px solid ${accent}25` }}>
              <span className="text-[9px] font-mono font-bold" style={{ color: accent }}>
                {category === 'prophecy' ? '🔮 3% PROOF OF FIRST (1/1)' : '🎲 8% FIRST HEARD PROOF'}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex -space-x-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-4 h-4 rounded-full" style={{
                  background: `linear-gradient(135deg, ${accent}40, ${accent}20)`,
                  border: '1px solid rgba(0,0,0,0.3)',
                }} />
              ))}
            </div>
            <span className="text-[9px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
              <Users size={9} className="inline mr-0.5" />
              {rippedCount.toLocaleString()} ripped
            </span>
          </div>
        </div>

        <div className="absolute inset-y-0 left-0 w-3" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.03), transparent)' }} />
        <div className="absolute inset-y-0 right-0 w-3" style={{ background: 'linear-gradient(270deg, rgba(255,255,255,0.03), transparent)' }} />

        {/* Info Toggle Button */}
        <div className="absolute right-3 top-3 z-30">
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{
              background: showInfo ? `${accent}cc` : 'rgba(0,0,0,0.6)',
              color: showInfo ? '#000' : 'var(--color-text-primary)',
              border: `1px solid ${showInfo ? accent : 'rgba(255,255,255,0.2)'}`,
              backdropFilter: 'blur(4px)',
            }}
          >
            {showInfo ? <X size={14} /> : <Info size={14} />}
          </button>
        </div>

        {/* Info Overlay (Drop Rates) */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 backdrop-blur-md"
              style={{ background: 'rgba(0,0,0,0.85)' }}
            >
              <h4 className="text-xl font-bold pack-label-neon mb-4 uppercase text-center" style={{ '--neon-accent': accent } as any}>
                Drop Rates
              </h4>
              <div className="w-full space-y-3 px-8">
                {['common', 'uncommon', 'rare', 'legendary', 'mythic'].map((r, i) => {
                  const rate = ROLL_RATES[category] ? ROLL_RATES[category][i] : ROLL_RATES.taste[i];
                  if (!rate) return null;
                  const cColor = RARITY_CONFIG[r as keyof typeof RARITY_CONFIG]?.color || '#fff';
                  return (
                    <div key={r} className="flex justify-between items-center text-sm font-mono pb-2 border-b border-white/10 last:border-b-0">
                      <span className="uppercase font-bold" style={{ color: cColor }}>{r}</span>
                      <span>{rate}%</span>
                    </div>
                  );
                })}
                {PROOF_RATES[category] && (
                  <div className="flex justify-between items-center text-sm font-mono pt-2 mt-2 border-t border-white/20">
                    <span className="uppercase font-bold text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(90deg, ${accent}, #fff)` }}>
                      1/1 PROOF
                    </span>
                    <span style={{ color: accent }}>{PROOF_RATES[category]}%</span>
                  </div>
                )}
              </div>

              {/* Pack Description */}
              {cfg.description && (
                <div
                  className="mt-5 px-6 text-center"
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: '14px',
                    width: '100%',
                  }}
                >
                  <p
                    className="text-[11px] font-mono italic leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.45)' }}
                  >
                    {cfg.description}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div 
        className="w-full mt-3 px-1 transition-opacity duration-300"
        style={{ 
          opacity: isActive ? 1 : 0.4, 
          pointerEvents: isActive ? 'auto' : 'none' 
        }}
      >
        <RipTab 
          onRip={() => onRip(category, tier.size)} 
          accent={(isFreeDisabled || isOverLimit) ? '#555' : accent} 
          disabled={disabledAction} 
          labelOverride={dynamicLabelOverride}
        />
      </div>
    </div>
  );
}

// ===== DRAGGABLE CAROUSEL =====
// ===== DRAGGABLE CAROUSEL =====
export default function PackShop({ onPurchase }: PackShopProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [freeClaimed, setFreeClaimed] = useState(false);
  const x = useMotionValue(0);
  const total = PACK_CAROUSEL_ORDER.length;

  useEffect(() => {
    hasClaimedFreePackToday().then(setFreeClaimed);
  }, []);

  const goTo = useCallback((idx: number) => {
    const i = (idx + total) % total; // wrap around loop
    setActiveIndex(i);
    animate(x, -i * SLIDE, { type: 'spring', stiffness: 300, damping: 32 });
  }, [x, total]);

  useEffect(() => { x.set(0); }, []);

  const onDragEnd = useCallback((_: never, info: PanInfo) => {
    const vel = info.velocity.x;
    const off = info.offset.x;
    let next = activeIndex;
    if (Math.abs(vel) > 250) next = vel < 0 ? activeIndex + 1 : activeIndex - 1;
    else if (Math.abs(off) > SLIDE * 0.25) next = off < 0 ? activeIndex + 1 : activeIndex - 1;
    goTo(next);
  }, [activeIndex, goTo]);

  // Handle rip initiation — all packs go straight to cinematic reveal
  const handleRip = useCallback((cat: PackCategory, size: PackSize) => {
    // Block free pack if already claimed
    if (cat === 'free' && freeClaimed) return;
    // Immediately mark free pack as claimed to prevent double-rips
    if (cat === 'free') setFreeClaimed(true);
    // All packs now use the cinematic drag-to-rip reveal
    onPurchase(cat, size);
  }, [onPurchase, freeClaimed]);

  const activeCat = PACK_CAROUSEL_ORDER[activeIndex];

  return (
    <section className="space-y-3 py-2">
      {/* Category tabs */}
      <div className="px-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none' }}>
        <div className="flex gap-2 w-max mx-auto">
          {PACK_CAROUSEL_ORDER.map((cat, i) => {
            const c = PACK_CONFIGS[cat];
            return (
              <button key={cat} onClick={() => goTo(i)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold transition-all whitespace-nowrap"
                style={{
                  background: i === activeIndex ? `${c.accent}20` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${i === activeIndex ? `${c.accent}40` : 'rgba(255,255,255,0.06)'}`,
                  color: i === activeIndex ? c.accent : 'var(--color-text-muted)',
                }}>
                <span>{c.icon}</span> {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Carousel */}
      <div className="relative">
        <button onClick={() => goTo(activeIndex - 1)} title="Previous Pack"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-15"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
          <ChevronLeft size={20} />
        </button>
        <button onClick={() => goTo(activeIndex + 1)} title="Next Pack"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-15"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
          <ChevronRight size={20} />
        </button>

        <div className="overflow-hidden py-3">
          <motion.div
            drag="x"
            // Removed tight drag constraints to allow elastic dragging past edges loosely
            onDragEnd={onDragEnd}
            style={{
              x,
              display: 'flex',
              gap: `${GAP}px`,
              paddingLeft: `calc(50vw - ${CARD_W / 2}px)`,
              paddingRight: `calc(50vw - ${CARD_W / 2}px)`,
              cursor: 'grab',
              touchAction: 'pan-y'
            }}
            className="active:cursor-grabbing"
          >
            {PACK_CAROUSEL_ORDER.map((cat, i) => (
              <PackBag
                key={cat}
                category={cat}
                isActive={i === activeIndex}
                onRip={handleRip}
                isRipping={false}
                isFreeClaimed={freeClaimed}
              />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5">
        {PACK_CAROUSEL_ORDER.map((cat, i) => (
          <button key={cat} onClick={() => goTo(i)} title={`Go to ${cat} pack`} className="transition-all duration-200"
            style={{
              width: i === activeIndex ? '18px' : '5px', height: '5px', borderRadius: '3px',
              background: i === activeIndex ? PACK_CONFIGS[cat].accent : 'rgba(255,255,255,0.12)',
            }} />
        ))}
      </div>
    </section>
  );
}
