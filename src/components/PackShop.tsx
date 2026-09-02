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
import { get365CardVariantStyle, getPackCoverFallback, getPackMultiCovers } from '../utils/cardVariants';
import { getFeaturedBombshellFoilCover, getRandomBombshellPackCover } from '../utils/bombshellCards';
import CyberPackBag from './CyberPackBag';

interface PackShopProps {
  onPurchase: (category: PackCategory, size: PackSize) => void;
}

const CARD_W = 280;
const GAP = 16;
const SLIDE = CARD_W + GAP;

type RipPhase = 'idle' | 'spotlight' | 'tearing' | 'cards_fly' | 'done';

// ===== PACK EMBLEM (Custom Icon) =====
function PackEmblem({ accent, size = 80, isBombshell = false }: { accent: string; size?: number; isBombshell?: boolean }) {
  return (
    <div className="relative flex justify-center items-center my-2 rounded-full mx-auto" style={{ width: size, height: size, boxShadow: `0 0 30px ${accent}40` }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ animation: 'spin-slow 16s linear infinite', transformOrigin: 'center', willChange: 'transform' }}>
        <path id="circlePath" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" fill="transparent" />
        <text fill={accent} fontWeight="900" style={{ textTransform: 'uppercase', fontSize: isBombshell ? '7.5px' : '8.5px', textShadow: `0 0 10px ${accent}`, letterSpacing: '1px' }}>
          <textPath href="#circlePath" startOffset="0%">
            {isBombshell ? '💖 BOMBSHELL • PANIK ED. •' : 'TH3SCR1B3 •  GEN 0  •'}
          </textPath>
          <textPath href="#circlePath" startOffset="50%">
            {isBombshell ? '💖 BOMBSHELL • PANIK ED. •' : 'TH3SCR1B3 •  GEN 0  •'}
          </textPath>
        </text>
        <circle cx="50" cy="50" r="23" fill="none" stroke={accent} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-black" style={{ 
          fontSize: size * 0.45, 
          color: '#fff', 
          fontFamily: '"Impact", "Arial Black", sans-serif',
          letterSpacing: '-1.5px',
          transform: 'scaleY(1.2) scaleX(0.9)',
          WebkitTextStroke: '1px #000',
          textShadow: `0 0 15px ${accent}, 2px 2px 0 #000`,
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

export interface PackBagProps {
  category: PackCategory;
  isActive?: boolean;
  isRipping?: boolean;
  isFreeClaimed?: boolean;
  showRipTab?: boolean;
  forcedSize?: PackSize;
  styleOverride?: 'classic_foil' | 'cyber_cartridge';
  onRip: (cat: PackCategory, size: PackSize) => void;
}

export function ClassicFoilPackBag({
  category,
  isActive = true,
  onRip,
  isRipping = false,
  isFreeClaimed,
  showRipTab = true,
  forcedSize,
}: Omit<PackBagProps, 'styleOverride'>) {
  const [tierIdx, setTierIdx] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [rippedCount, setRippedCount] = useState<number>(0);

  const cfg = PACK_CONFIGS[category];
  const accent = cfg.accent;
  const activeTierIndex = forcedSize ? Math.max(0, cfg.tiers.findIndex(t => t.size === forcedSize)) : tierIdx;
  const tier = cfg.tiers[activeTierIndex] || cfg.tiers[0];
  const isSpecial = category === 'prophecy' || category === 'alpha';
  const isFreeDisabled = category === 'free' && isFreeClaimed;

  const [bombshellSide, setBombshellSide] = useState<'top' | 'bot'>(() => Math.random() < 0.5 ? 'top' : 'bot');

  useEffect(() => {
    if (category === 'bombshell' || category === 'bombshell_token') {
      setBombshellSide(Math.random() < 0.5 ? 'top' : 'bot');
    }
  }, [category, activeTierIndex]);

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
  
  let requiredTokens = 0;
  if (category === 'vault_token') requiredTokens = tokenPackCost;
  else if (category === 'bombshell_token') requiredTokens = 100 * (tier.cardCount || 1);
  else if (category === 'targeted_pull') requiredTokens = 500;
  else if (category === 'rarity_upgrade') requiredTokens = 150;

  const hasEnoughTokens = tokenBalance >= requiredTokens;
  const isTokenBased = category === 'vault_token' || category === 'bombshell_token' || category === 'targeted_pull' || category === 'rarity_upgrade';

  const disabledAction = isRipping || !isActive || isFreeDisabled || isOverLimit || (isTokenBased && !hasEnoughTokens);

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
  else if (isTokenBased && !hasEnoughTokens) dynamicLabelOverride = `NEED ${requiredTokens} V⚡`;

  const repeatedText = Array(5).fill(0).map(() => `365 DAYS OF LIGHT AND DARK \u2022 ${cfg.label}`).join(' \u2022 ');

  const variant = get365CardVariantStyle(cfg.category);
  const isBombshell = cfg.category === 'bombshell' || cfg.category === 'bombshell_token' || cfg.label?.toLowerCase().includes('bombshell');
  const countNum = tier.cardCount >= 50 ? 50 : tier.cardCount >= 25 ? 25 : tier.cardCount >= 10 ? 10 : tier.cardCount >= 5 ? 5 : tier.cardCount >= 2 ? 2 : 1;
  const plural = countNum === 1 ? 'card' : 'cards';
  const foilCoverUrl = isBombshell 
    ? (tier.coverImage || '/data/packs/bs_cover.png')
    : (tier.coverImage || cfg.coverImage || getPackCoverFallback(cfg.category));

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
        .sale-burst {
          clip-path: polygon(
            50% 0%, 63% 4%, 74% 1%, 82% 10%, 93% 8%, 97% 20%, 100% 31%, 97% 42%, 100% 53%, 97% 64%, 100% 75%, 93% 84%, 97% 95%, 86% 97%, 75% 100%, 64% 97%, 53% 100%, 42% 97%, 31% 100%, 22% 93%, 11% 97%, 5% 86%, 0% 75%, 3% 64%, 0% 53%, 3% 42%, 0% 31%, 7% 22%, 3% 11%, 14% 5%, 25% 0%, 36% 3%
          );
        }
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
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        background: isBombshell ? '#000000' : cfg.gradient,
        boxShadow: isActive ? `0 20px 60px rgba(0,0,0,0.6), 0 0 30px ${accent}40, inset 0 0 25px rgba(255,255,255,0.3)` : '0 10px 30px rgba(0,0,0,0.3)',
        transform: isActive ? 'scale(1)' : 'scale(0.85)',
        opacity: isActive ? 1 : 0.4,
        transition: 'transform 0.35s cubic-bezier(.22,1,.36,1), opacity 0.35s ease, box-shadow 0.35s ease',
      }}>
        {(() => {
          if (isBombshell) {
            return (
              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-center" style={{ background: 'linear-gradient(165deg, #13010b 0%, #2d031c 40%, #0d0108 100%)' }}>
                {/* Panik Cyber Ambient Neon Halo */}
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at 50% 35%, rgba(255, 20, 147, 0.48) 0%, rgba(255, 0, 100, 0.24) 45%, transparent 75%)',
                    mixBlendMode: 'screen',
                    zIndex: 1,
                  }}
                />

                {/* Subtle Cyber Matrix Grid */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    backgroundImage: 'linear-gradient(rgba(255,20,147,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,20,147,0.3) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    zIndex: 1,
                  }}
                />

                {/* Sliced Cutout Artwork Plate */}
                {foilCoverUrl && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center" style={{ zIndex: 2 }}>
                    <img
                      src={foilCoverUrl}
                      alt={`Bombshell Pack ${tier.cardCount} Cards`}
                      className="w-full h-full object-cover pointer-events-none select-none transition-transform duration-300"
                      style={{
                        transform: isActive ? 'scale(1.03)' : 'scale(1)',
                        filter: 'contrast(1.2) saturate(1.35) brightness(1.05) drop-shadow(0 0 24px rgba(255,20,147,0.75))',
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/data/packs/bs_cover.png';
                      }}
                    />
                  </div>
                )}

                {/* Animated Iridescent Panik Foil Shimmer */}
                <div
                  className="absolute inset-0 pointer-events-none foil-holo-prism"
                  style={{
                    background: 'linear-gradient(115deg, transparent 20%, rgba(255, 20, 147, 0.4) 40%, rgba(255, 255, 255, 0.75) 50%, rgba(0, 229, 255, 0.4) 60%, transparent 80%)',
                    mixBlendMode: 'color-dodge',
                    opacity: isActive ? 0.65 : 0.35,
                    zIndex: 3,
                  }}
                />

                {/* Top/Bot Lighting Vignette */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,20,147,0.15) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.85) 100%)',
                    zIndex: 4,
                  }}
                />
              </div>
            );
          }

          return (
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-center" style={{ background: 'rgba(6,3,14,0.96)' }}>
              {foilCoverUrl && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
                  <img
                    src={foilCoverUrl}
                    alt="Foil Artwork"
                    className="w-full h-full object-cover"
                    style={{
                      transform: 'scale(1.15)',
                      objectPosition: 'center 25%',
                      filter: 'contrast(1.15) brightness(0.7) saturate(1.2)',
                      mixBlendMode: 'normal',
                      opacity: isActive ? 0.45 : 0.25,
                    }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(160deg, rgba(0, 229, 255, 0.35) 0%, rgba(10, 16, 32, 0.75) 100%)',
                      mixBlendMode: 'color',
                      opacity: 0.9,
                    }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse at 50% 30%, rgba(255, 255, 255, 0.25) 0%, transparent 65%)',
                      mixBlendMode: 'screen',
                      opacity: 0.7,
                    }}
                  />
                </div>
              )}

              <div
                className="absolute inset-0 pointer-events-none transition-all"
                style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(160deg, ${accent}ee 0%, ${accent}aa 45%, rgba(6,3,14,0.96) 100%)`,
                  mixBlendMode: 'hard-light',
                  opacity: 0.88,
                  zIndex: 2,
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none transition-all"
                style={{
                  position: 'absolute', inset: 0,
                  background: accent,
                  mixBlendMode: 'color',
                  opacity: 0.85,
                  zIndex: 3,
                }}
              />
            </div>
          );
        })()}
        
        <div className="absolute inset-x-0 top-0 h-[22px] foil-crimp-serrated-top z-20" />
        <div className="absolute inset-x-0 bottom-0 h-[22px] foil-crimp-serrated-bottom z-20" />
        <div className="foil-tear-notch-left" />
        <div className="foil-tear-notch-right" />
        <div className="foil-fin-seal" />
        <div className="foil-holo-prism" style={{ opacity: isActive ? 0.45 : 0.2 }} />
        <div className="foil-card-bulge" />
        <div className="foil-wrinkles-overlay" />
        <div className="foil-metallic-sheen" />
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay" style={{
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='foilNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.035 0.08' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23foilNoise)'/%3E%3C/svg%3E")`,
          opacity: 0.32,
          zIndex: 4,
        }} />

        {/* BRUTALIST & PANIK STAMPS & BADGING (For all packs including Bombshell) */}
        <>
          <div className="absolute left-0 bottom-12 w-8 flex items-center justify-center pointer-events-none z-20 mix-blend-overlay">
            <div className="font-black leading-none uppercase whitespace-nowrap" style={{
              transform: 'rotate(-90deg) scaleY(1.3) scaleX(0.9)',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: '18px',
              letterSpacing: '-1.5px',
              WebkitTextStroke: `1px ${accent}`,
              textShadow: `0 0 14px ${accent}`,
            }}>
              {isBombshell ? 'PANIK // BOMBSHELL' : 'TH3SCR1B3'}
            </div>
          </div>

          <div className="absolute left-3 top-3 z-30 pointer-events-none">
            <div
              className="pack-price-stamp"
              style={{
                '--stamp-stripe': `${accent}20`,
                borderColor: isBombshell ? '#FF1493' : '#000',
                boxShadow: isBombshell ? '3px 3px 0 #FF1493, 0 0 14px rgba(255,20,147,0.5)' : '4px 4px 0 #000',
                transform: 'rotate(-2.5deg)',
              } as any}
            >
              <span style={{ fontSize: '7px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7, lineHeight: 1, marginBottom: 2, color: isBombshell ? '#FF1493' : '#000' }}>
                PRICE
              </span>
              <span style={{ fontSize: '28px', lineHeight: 1, letterSpacing: '-1.5px', fontFamily: '"Impact", "Arial Black", sans-serif', transform: 'scaleY(1.18)', transformOrigin: 'center', display: 'block', fontWeight: 900, color: isBombshell ? '#000' : '#000' }}>
                {tier.price === 'FREE' ? 'FREE' : tier.price}
              </span>
              <span style={{ fontSize: '7px', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', opacity: 0.6, marginTop: 1, textTransform: 'uppercase', color: isBombshell ? '#FF1493' : '#000' }}>
                {tier.price === 'FREE' ? 'no cost' : 'per pack'}
              </span>
            </div>
          </div>

          <div className="absolute right-3 bottom-16 z-30 pointer-events-none">
            <div
              className="pack-price-stamp"
              style={{
                '--stamp-stripe': `${accent}20`,
                borderColor: isBombshell ? '#FF1493' : '#000',
                boxShadow: isBombshell ? '3px 3px 0 #FF1493, 0 0 14px rgba(255,20,147,0.5)' : '3px 3px 0 #000',
                transform: 'rotate(1.5deg)',
                padding: '3px 10px',
                minWidth: '60px',
              } as any}
            >
              <span style={{ fontSize: '6px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7, lineHeight: 1, marginBottom: 1, color: isBombshell ? '#FF1493' : '#000' }}>
                CONTENTS
              </span>
              <span style={{ fontSize: '18px', lineHeight: 1, letterSpacing: '-1px', fontFamily: '"Impact", "Arial Black", sans-serif', transform: 'scaleY(1.18)', transformOrigin: 'center', display: 'block', fontWeight: 900, color: '#000' }}>
                {tier.cardCount}{tier.cardCount === 1 ? '' : '×'}
              </span>
              <span style={{ fontSize: '6px', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', opacity: 0.6, marginTop: 1, textTransform: 'uppercase', color: isBombshell ? '#FF1493' : '#000' }}>
                {tier.cardCount === 1 ? 'pack' : 'cards'}
              </span>
            </div>
          </div>

          {/* Top/Bot Side Switcher Toggle for Bombshell */}
          {isBombshell && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBombshellSide(prev => prev === 'top' ? 'bot' : 'top');
                }}
                className="px-2.5 py-1 rounded-full text-[8px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                style={{
                  background: 'rgba(0, 0, 0, 0.85)',
                  border: '1.5px solid #FF1493',
                  color: '#FF1493',
                  boxShadow: '0 0 14px rgba(255,20,147,0.6)',
                }}
              >
                <span>{bombshellSide === 'top' ? '🌙 TOP (DARK)' : '☀️ BOT (LIGHT)'}</span>
                <span className="text-[7px] opacity-70">⟲ FLIP</span>
              </button>
            </div>
          )}

          <div className="absolute inset-0 opacity-60 mix-blend-screen pointer-events-none" style={{
            background: `radial-gradient(ellipse at 50% 15%, ${accent}40, transparent 50%), radial-gradient(ellipse at 50% 85%, ${accent}30, transparent 50%)`,
            zIndex: 0,
          }} />

          <div className="absolute inset-0 overflow-hidden pointer-events-none mix-blend-overlay" style={{ zIndex: 1 }}>
            <div className="absolute top-10 left-0 right-0 whitespace-nowrap" style={{ 
              width: '200%', display: 'flex',
              animation: isActive ? 'breathe-opacity 6s ease-in-out infinite' : 'none',
              opacity: isBombshell ? 0.35 : 0.2,
            }}>
              <div className="pack-marquee-text" style={{ animation: isActive ? 'scroll-left 40s linear infinite' : 'none', fontSize: '6rem', lineHeight: 1, '--neon-accent': accent } as any}>
                {repeatedText}
              </div>
            </div>
            <div className="absolute bottom-10 right-0 whitespace-nowrap flex justify-end" style={{ 
              width: '200%',
              animation: isActive ? 'breathe-opacity 6s ease-in-out infinite' : 'none',
              animationDelay: isActive ? '-2s' : '0s',
              opacity: isBombshell ? 0.35 : 0.2,
            }}>
              <div className="pack-marquee-text" style={{ animation: isActive ? 'scroll-left 30s linear infinite reverse' : 'none', fontSize: '4.5rem', lineHeight: 1, '--neon-accent': accent } as any}>
                {repeatedText}
              </div>
            </div>
          </div>
        </>

            <div className="relative flex flex-col items-center justify-between h-full pt-[20px] pb-[32px] px-5 z-10">
              <div className="h-6" />

              <div className="text-center space-y-1.5 my-auto flex flex-col items-center w-full">
                <h3 
                  className={`leading-[0.92] pack-label-neon uppercase font-black text-center max-w-[240px] ${
                    cfg.label.length > 18 
                      ? 'text-[20px] sm:text-[22px]' 
                      : cfg.label.length > 12 
                        ? 'text-[24px] sm:text-[28px]' 
                        : 'text-[30px] sm:text-[34px]'
                  }`} 
                  style={{
                    '--neon-accent': accent,
                    color: '#ffffff',
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    letterSpacing: '-0.01em',
                    transform: 'scaleY(1.06)',
                    transformOrigin: 'center',
                    WebkitTextStroke: '1.5px #000000',
                    textShadow: `
                      0 0 18px ${accent}, 
                      0 0 36px ${accent}80, 
                      2px 3px 0 #000000, 
                      3px 6px 16px rgba(0,0,0,0.95)
                    `,
                    margin: '4px 0 6px 0',
                  } as React.CSSProperties}
                >
                  {cfg.label}
                </h3>
                
                <div className="flex justify-center">
                  <PackEmblem accent={accent} size={74} isBombshell={isBombshell} />
                </div>

                <div className="text-center mt-2">
                  <div className="inline-block">
                    <div className="sticker-gun-tag sticker-slits drop-shadow-md" style={{
                      background: '#ffffff',
                      border: `1.5px solid ${accent}40`,
                      '--slit-color': `${accent}22`,
                      padding: '3px 10px',
                      transform: 'rotate(0.5deg)',
                      minWidth: '150px'
                    } as any}>
                      <span className="text-[8.5px] font-black tracking-tighter uppercase italic opacity-90" style={{ color: '#000' }}>
                        {variant.tagline}
                      </span>
                    </div>
                  </div>
                </div>

                {cfg.description && (
                  <p className="text-[9.5px] font-mono mt-2 line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>
                    {cfg.description}
                  </p>
                )}
              </div>

              {isSpecial && (
                <div className="px-3 py-1 rounded-lg my-1" style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                  <span className="text-[8.5px] font-mono font-bold" style={{ color: accent }}>
                    {category === 'prophecy' ? '🔮 3% PROOF OF FIRST (1/1)' : '🎲 8% FIRST HEARD PROOF'}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[8.5px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
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
              className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 backdrop-blur-md"
              style={{ background: 'rgba(0,0,0,0.88)' }}
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

      {/* Multi-Tier Quantity Selector (e.g. 1x, 5x, 15x) */}
      {showRipTab && cfg.tiers.length > 1 && (
        <div 
          className="flex items-center justify-center gap-1.5 w-full mt-2.5 px-1 z-30 transition-opacity duration-300"
          style={{ 
            opacity: isActive ? 1 : 0.4, 
            pointerEvents: isActive ? 'auto' : 'none' 
          }}
        >
          <span className="text-[9px] font-mono font-bold text-white/50 tracking-wider mr-0.5">
            QTY:
          </span>
          {cfg.tiers.map((t, i) => {
            const isSelected = i === (forcedSize ? Math.max(0, cfg.tiers.findIndex(x => x.size === forcedSize)) : tierIdx);
            return (
              <button
                key={t.size || i}
                onClick={(e) => {
                  e.stopPropagation();
                  setTierIdx(i);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-black transition-all cursor-pointer select-none ${
                  isSelected 
                    ? 'scale-105 shadow-lg' 
                    : 'opacity-70 hover:opacity-100 hover:scale-102'
                }`}
                style={{
                  background: isSelected ? accent : 'rgba(20,22,30,0.85)',
                  color: isSelected ? '#000000' : '#ffffff',
                  border: `1.5px solid ${isSelected ? accent : 'rgba(255,255,255,0.15)'}`,
                  boxShadow: isSelected ? `0 0 14px ${accent}60, 2px 2px 0 #000` : 'none',
                }}
              >
                <span>{t.cardCount}×</span>
                <span className="text-[9px] font-bold" style={{ color: isSelected ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.55)' }}>
                  {t.price}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showRipTab && (
        <div 
          className="w-full mt-2 px-1 transition-opacity duration-300"
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
      )}
    </div>
  );
}

// ===== PACK BAG WRAPPER (SUPPORTS CLASSIC FOIL & CYBER CARTRIDGE) =====
export function PackBag(props: PackBagProps) {
  const packDesignStyle = useVaultStore((s) => s.packDesignStyle);
  const activeStyle = props.styleOverride || packDesignStyle || 'cyber_cartridge';

  if (activeStyle === 'cyber_cartridge') {
    return (
      <CyberPackBag
        category={props.category}
        isActive={props.isActive}
        onRip={props.onRip}
        isRipping={props.isRipping}
        isFreeClaimed={props.isFreeClaimed}
        showRipTab={props.showRipTab}
        forcedSize={props.forcedSize}
      />
    );
  }

  return <ClassicFoilPackBag {...props} />;
}

// ===== DRAGGABLE CAROUSEL =====
// ===== DRAGGABLE CAROUSEL =====
export default function PackShop({ onPurchase }: PackShopProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [freeClaimed, setFreeClaimed] = useState(false);
  const { packDesignStyle, setPackDesignStyle } = useVaultStore();
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
      {/* Pack Design Chassis Switcher */}
      <div className="flex items-center justify-between px-4 max-w-2xl mx-auto mb-1">
        <div className="flex items-center gap-1.5 opacity-60">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[9px] font-mono font-bold tracking-[0.2em] uppercase text-slate-300">
            PACK CHASSIS:
          </span>
        </div>
        <div className="inline-flex p-1 rounded-lg bg-black/70 border border-white/15 backdrop-blur-md shadow-lg">
          <button
            onClick={() => setPackDesignStyle('classic_foil')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all ${
              packDesignStyle === 'classic_foil'
                ? 'bg-amber-400 text-black shadow-[0_0_12px_rgba(251,191,36,0.5)] scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>🏷️</span> CLASSIC FOIL
          </button>
          <button
            onClick={() => setPackDesignStyle('cyber_cartridge')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all ${
              packDesignStyle === 'cyber_cartridge'
                ? 'bg-cyan-400 text-black shadow-[0_0_12px_rgba(0,229,255,0.5)] scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>⚡</span> CYBER MATRIX
          </button>
        </div>
      </div>

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
