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
import FoilPackFace from './foil/FoilPackFace';

interface PackShopProps {
  onPurchase: (category: PackCategory, size: PackSize) => void;
}

const CARD_W = 280;
const GAP = 16;
const SLIDE = CARD_W + GAP;

type RipPhase = 'idle' | 'spotlight' | 'tearing' | 'cards_fly' | 'done';

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
  forcedCoverImage?: string;
  forcedTheme?: 'light' | 'dark';
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
  forcedCoverImage,
  forcedTheme,
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

  const [bombshellSide, setBombshellSide] = useState<'top' | 'bot'>(() => forcedTheme === 'light' ? 'bot' : 'top');

  useEffect(() => {
    if (forcedTheme) {
      setBombshellSide(forcedTheme === 'light' ? 'bot' : 'top');
    } else if (category === 'bombshell' || category === 'bombshell_token') {
      setBombshellSide(Math.random() < 0.5 ? 'top' : 'bot');
    }
  }, [category, activeTierIndex, forcedTheme]);

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

  const variant = get365CardVariantStyle(cfg.category);
  const isBombshell = cfg.category === 'bombshell' || cfg.category === 'bombshell_token' || cfg.label?.toLowerCase().includes('bombshell');
  const countNum = tier.cardCount >= 50 ? 50 : tier.cardCount >= 25 ? 25 : tier.cardCount >= 10 ? 10 : tier.cardCount >= 5 ? 5 : tier.cardCount >= 2 ? 2 : 1;
  const plural = countNum === 1 ? 'card' : 'cards';
  const activeTheme = forcedTheme || (bombshellSide === 'bot' ? 'light' : 'dark');
  const foilCoverUrl = forcedCoverImage || (isBombshell 
    ? (activeTheme === 'light'
        ? (tier.lightCoverImage || tier.coverImage || `/data/packs/bombshell_light_${countNum}${plural}.jpg`)
        : (tier.darkCoverImage || tier.coverImage || `/data/packs/bombshell_dark_${countNum}${plural}.jpg`))
    : (tier.coverImage || cfg.coverImage || getPackCoverFallback(cfg.category)));

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
      <div className="relative w-full" style={{
        aspectRatio: '3 / 4.5',
        borderRadius: '8px',
        transform: isActive ? 'scale(1)' : 'scale(0.85)',
        opacity: isActive ? 1 : 0.4,
        transition: 'transform 0.35s cubic-bezier(.22,1,.36,1), opacity 0.35s ease',
      }}>
        <FoilPackFace
          accent={accent}
          label={cfg.label}
          coverUrl={foilCoverUrl}
          fallbackCoverUrl={isBombshell ? '/data/packs/bs_cover.png' : undefined}
          fullArt={isBombshell}
          price={tier.price}
          cardCount={tier.cardCount}
          tagline={isBombshell ? 'Bombshell anime graffiti cards' : variant.tagline}
          footer={
            <>
              {isSpecial && (
                <div style={{ color: accent, marginBottom: '1.6cqw', letterSpacing: '0.08em' }}>
                  {category === 'prophecy' ? '🔮 3% proof of first (1/1)' : '🎲 8% first heard proof'}
                </div>
              )}
              <Users size={9} className="inline mr-1" style={{ verticalAlign: '-1px' }} />
              {rippedCount.toLocaleString()} ripped
            </>
          }
          active={isActive}
          interactive
        />

        {/* Light / Dark Side Switcher Toggle for Bombshell */}
        {isBombshell && !forcedTheme && (
          <div className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-auto" style={{ top: '57%' }}>
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
              <span>{bombshellSide === 'top' ? '🌙 DARK' : '☀️ LIGHT'}</span>
              <span className="text-[7px] opacity-70">⟲ FLIP</span>
            </button>
          </div>
        )}

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
              className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 backdrop-blur-md rounded-lg"
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
  const activeStyle = props.styleOverride || packDesignStyle || 'classic_foil';

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
        forcedCoverImage={props.forcedCoverImage}
        forcedTheme={props.forcedTheme}
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
            <span>✨</span> HOLO FOIL
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
