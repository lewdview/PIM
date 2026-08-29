import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, animate, AnimatePresence } from 'framer-motion';
import { ChevronRight, Cpu, ShieldCheck, Zap, Info, X, Users } from 'lucide-react';
import {
  PACK_CONFIGS,
  type PackCategory, type PackSize,
  ROLL_RATES, PROOF_RATES, RARITY_CONFIG,
} from '../utils/rarity';
import { getTimeUntilNextDay } from '../utils/dayCalc';
import { useVaultStore } from '../store/useVaultStore';
import { getAdminConfig } from '../utils/adminConfig';
import { get365CardVariantStyle, getPackCoverFallback } from '../utils/cardVariants';
import { getFeaturedBombshellFoilCover, getRandomBombshellPackCover } from '../utils/bombshellCards';

interface CyberPackBagProps {
  category: PackCategory;
  isActive?: boolean;
  isRipping?: boolean;
  isFreeClaimed?: boolean;
  showRipTab?: boolean;
  forcedSize?: PackSize;
  onRip: (cat: PackCategory, size: PackSize) => void;
}

const CARD_W = 280;

// ===== CYBER APERTURE EMBLEM =====
export function CyberApertureEmblem({ accent, size = 80, isBombshell = false }: { accent: string; size?: number; isBombshell?: boolean }) {
  return (
    <div 
      className="relative flex justify-center items-center my-2 rounded-full mx-auto" 
      style={{ 
        width: size, 
        height: size, 
        filter: `drop-shadow(0 0 18px ${accent}60)` 
      }}
    >
      {/* Outer Hexagon Orbit Ring */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full cyber-hex-ring">
        <polygon 
          points="50,4 90,27 90,73 50,96 10,73 10,27" 
          fill="none" 
          stroke={accent} 
          strokeWidth="1.5" 
          strokeDasharray="6 4"
          opacity="0.85"
        />
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      </svg>

      {/* Inner Reverse Counter-Orbit Ring */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full cyber-hex-ring-reverse">
        <path id="cyberCirclePath" d="M 50, 50 m -32, 0 a 32,32 0 1,1 64,0 a 32,32 0 1,1 -64,0" fill="transparent" />
        <text fill={accent} fontWeight="900" style={{ textTransform: 'uppercase', fontSize: '7px', letterSpacing: '1.5px', textShadow: `0 0 8px ${accent}` }}>
          <textPath href="#cyberCirclePath" startOffset="0%">
            {isBombshell ? '★ BOMBSHELL • MATRIX ★' : 'CORE // 365 • DATA BUS •'}
          </textPath>
          <textPath href="#cyberCirclePath" startOffset="50%">
            {isBombshell ? '★ BOMBSHELL • MATRIX ★' : 'CORE // 365 • DATA BUS •'}
          </textPath>
        </text>
        <polygon 
          points="50,15 80,32 80,68 50,85 20,68 20,32" 
          fill="none" 
          stroke="rgba(255,255,255,0.3)" 
          strokeWidth="1" 
        />
      </svg>

      {/* Center 365 Data Core Glyph */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span 
          className="font-black" 
          style={{ 
            fontSize: size * 0.42, 
            color: '#ffffff', 
            fontFamily: '"Impact", "Arial Black", sans-serif',
            letterSpacing: '-1.5px',
            transform: 'scaleY(1.2) scaleX(0.92)',
            WebkitTextStroke: '1px #000',
            textShadow: `0 0 16px ${accent}, 2px 2px 0 #000`,
          }}
        >
          365
        </span>
      </div>
    </div>
  );
}

// ===== CYBER RIP TAB (High-Tech Matrix Breach Actuator) =====
export function CyberRipTab({ onRip, accent, disabled, labelOverride }: { onRip: () => void; accent: string; disabled?: boolean; labelOverride?: string }) {
  const dragX = useMotionValue(0);
  const [isBreached, setIsBreached] = useState(false);
  const [maxX, setMaxX] = useState(220);
  const ref = useRef<HTMLDivElement>(null);

  const handleDragEnd = useCallback(() => {
    if (disabled) return;
    if (dragX.get() > maxX * 0.55) {
      setIsBreached(true);
      animate(dragX, maxX, { duration: 0.15 });
      setTimeout(() => {
        onRip();
        setTimeout(() => { setIsBreached(false); animate(dragX, 0, { duration: 0.3 }); }, 1500);
      }, 200);
    } else {
      animate(dragX, 0, { type: 'spring', stiffness: 500, damping: 30 });
    }
  }, [dragX, maxX, onRip, disabled]);

  return (
    <div
      ref={ref}
      className="relative h-14 overflow-hidden select-none"
      style={{
        background: 'linear-gradient(135deg, rgba(8,10,18,0.92) 0%, rgba(15,20,32,0.92) 100%)',
        border: `1.5px solid ${accent}45`,
        clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
        boxShadow: `0 0 20px ${accent}20, inset 0 0 15px rgba(0,0,0,0.8)`,
      }}
      onPointerDown={() => { if (ref.current) setMaxX(ref.current.offsetWidth - 56); }}
    >
      {/* Background Circuit Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(${accent}30 1px, transparent 1px), linear-gradient(90deg, ${accent}30 1px, transparent 1px)`,
          backgroundSize: '12px 12px',
        }}
      />

      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span 
          className="text-[11px] font-mono font-bold tracking-[0.28em] uppercase text-center leading-tight px-4 flex items-center gap-2"
          style={{ color: `${accent}`, textShadow: `0 0 8px ${accent}80` }}
        >
          {!labelOverride && <Zap size={13} className="animate-pulse" />}
          {labelOverride ? labelOverride : isBreached ? 'DECRYPTING...' : 'BREACH MATRIX'}
        </span>
      </div>

      {/* Sliding Actuator Puck */}
      <motion.div
        drag={disabled ? false : 'x'}
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0.02}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className="absolute left-1 top-1 bottom-1 w-12 z-10 cursor-grab active:cursor-grabbing flex items-center justify-center"
        whileTap={{ scale: 0.94 }}
      >
        <div 
          className="w-full h-full flex items-center justify-center"
          style={{ 
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, 
            clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
            boxShadow: `0 0 20px ${accent}`,
          }}
        >
          <ChevronRight size={20} color="#000" strokeWidth={3.5} />
        </div>
      </motion.div>
    </div>
  );
}

// ===== CYBER PACK BAG COMPONENT =====
export default function CyberPackBag({
  category,
  isActive = true,
  onRip,
  isRipping = false,
  isFreeClaimed,
  showRipTab = true,
  forcedSize,
}: CyberPackBagProps) {
  const [tierIdx, setTierIdx] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [rippedCount, setRippedCount] = useState<number>(0);

  const cfg = PACK_CONFIGS[category] || PACK_CONFIGS.taste;
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
        limitLabel = `Daily Limit (${limits.premium}/${maxPremium})`;
      }
    } else {
      if (limits.standard + tier.cardCount > maxStandard) {
        isOverLimit = true;
        limitLabel = `Daily Limit (${limits.standard}/${maxStandard})`;
      }
    }
  }

  const tokenBalance = useVaultStore((s) => s.tokenBalance);
  const tokenPackCost = adminCfg.tokenPackCost ?? 275;
  
  let requiredTokens = 0;
  if (category === 'vault_token') requiredTokens = tokenPackCost;
  else if (category === 'bombshell_token') requiredTokens = 100;
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
      setCountdown(`NEXT IN ${t.hours}H ${String(t.minutes).padStart(2, '0')}M`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isFreeDisabled]);

  let dynamicLabelOverride = '';
  if (isFreeDisabled) dynamicLabelOverride = countdown || 'CLAIMED TODAY';
  else if (isOverLimit) dynamicLabelOverride = limitLabel;
  else if (isTokenBased && !hasEnoughTokens) dynamicLabelOverride = `NEED ${requiredTokens} V⚡`;

  const isBombshell = cfg.category === 'bombshell' || cfg.category === 'bombshell_token' || cfg.label?.toLowerCase().includes('bombshell');
  const countNum = tier.cardCount >= 50 ? 50 : tier.cardCount >= 25 ? 25 : tier.cardCount >= 10 ? 10 : tier.cardCount >= 5 ? 5 : tier.cardCount >= 2 ? 2 : 1;
  const plural = countNum === 1 ? 'card' : 'cards';
  const foilCoverUrl = isBombshell 
    ? (tier.coverImage || '/data/packs/bs_cover.png')
    : (tier.coverImage || cfg.coverImage || getPackCoverFallback(cfg.category));

  const variant = get365CardVariantStyle(cfg.category);

  return (
    <div className="flex-shrink-0 flex flex-col items-center" style={{ width: `${CARD_W}px` }}>
      {/* Precision Cartridge Shell */}
      <div 
        className="cyber-cartridge-frame relative w-full overflow-hidden" 
        style={{
          aspectRatio: '3 / 4.5',
          background: isBombshell ? 'linear-gradient(165deg, #13010b 0%, #2d031c 40%, #0d0108 100%)' : 'linear-gradient(175deg, #07070d 0%, #0d0e17 40%, #05060a 100%)',
          boxShadow: isActive 
            ? `0 24px 70px rgba(0,0,0,0.85), 0 0 40px ${accent}60, inset 0 0 30px rgba(0,0,0,0.9)` 
            : '0 10px 30px rgba(0,0,0,0.4)',
          transform: isActive ? 'scale(1)' : 'scale(0.86)',
          opacity: isActive ? 1 : 0.4,
          border: `1.5px solid ${accent}70`,
          transition: 'transform 0.35s cubic-bezier(.22,1,.36,1), opacity 0.35s ease, box-shadow 0.35s ease',
          '--conduit-accent': accent,
          '--stamp-accent': accent,
          '--stamp-accent-glow': `${accent}70`,
        } as any}
      >
        {/* Carbon Weave Texture Layer */}
        <div className="cyber-carbon-weave absolute inset-0 opacity-40 pointer-events-none z-0" />

        {/* Panik Cyber Ambient Neon Halo for Bombshell */}
        {isBombshell && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 35%, rgba(255, 20, 147, 0.48) 0%, rgba(255, 0, 100, 0.24) 45%, transparent 75%)',
              mixBlendMode: 'screen',
              zIndex: 1,
            }}
          />
        )}

        {/* Embedded Artwork Underplate */}
        {foilCoverUrl && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex items-center justify-center">
            <img
              src={foilCoverUrl}
              alt="Cartridge Core Art"
              className="w-full h-full object-cover pointer-events-none select-none transition-transform duration-300"
              style={{
                transform: isActive ? 'scale(1.03)' : 'scale(1)',
                filter: isBombshell ? 'contrast(1.2) saturate(1.35) brightness(1.05) drop-shadow(0 0 24px rgba(255,20,147,0.75))' : 'contrast(1.2) brightness(0.85)',
                mixBlendMode: isBombshell ? 'normal' : 'luminosity',
                opacity: isBombshell ? 1 : 0.45,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = isBombshell ? '/data/packs/bs_cover.png' : `/data/packs/bombshell_top_${countNum}${plural}.jpg`;
              }}
            />
            {!isBombshell && (
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(180deg, rgba(5,6,10,0.3) 0%, rgba(5,6,10,0.85) 70%, #05060a 100%)`,
                  mixBlendMode: 'multiply',
                }}
              />
            )}
          </div>
        )}

        {/* Animated Iridescent Panik Foil Shimmer for Bombshell */}
        {isBombshell && (
          <div
            className="absolute inset-0 pointer-events-none foil-holo-prism"
            style={{
              background: 'linear-gradient(115deg, transparent 20%, rgba(255, 20, 147, 0.4) 40%, rgba(255, 255, 255, 0.75) 50%, rgba(0, 229, 255, 0.4) 60%, transparent 80%)',
              mixBlendMode: 'color-dodge',
              opacity: isActive ? 0.65 : 0.35,
              zIndex: 3,
            }}
          />
        )}

        {/* Top Gold Multi-Pin Bus Terminals */}
        <div className="cyber-bus-pins-top absolute inset-x-0 top-0 h-[18px] z-20" />

        {/* Bottom Gold Multi-Pin Bus Terminals */}
        <div className="cyber-bus-pins-bottom absolute inset-x-0 bottom-0 h-[18px] z-20" />

        {/* Dual Neon Light Conduits (Left & Right Rails) */}
        <div className="cyber-light-conduit-left z-20" />
        <div className="cyber-light-conduit-right z-20" />

        {/* Corner Micro-Bolts */}
        <div className="absolute top-5 left-4 w-2 h-2 rounded-full bg-slate-800 border border-white/20 z-20" />
        <div className="absolute top-5 right-4 w-2 h-2 rounded-full bg-slate-800 border border-white/20 z-20" />
        <div className="absolute bottom-5 left-4 w-2 h-2 rounded-full bg-slate-800 border border-white/20 z-20" />
        <div className="absolute bottom-5 right-4 w-2 h-2 rounded-full bg-slate-800 border border-white/20 z-20" />

        {/* Active Telemetry Header Band */}
        <div className="absolute top-5 inset-x-7 flex items-center justify-between z-20">
          <div className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[7px] font-mono font-bold tracking-wider text-emerald-300">ONLINE</span>
          </div>
          <div className="text-[7px] font-mono text-white/50 tracking-widest uppercase">
            {isBombshell ? 'SPEC // PANIK-BOMB' : `SPEC // ${category.toUpperCase().slice(0, 8)}`}
          </div>
        </div>

        {/* TOP-LEFT: Laser Security Price Seal */}
        <div className="absolute left-4 top-11 z-30 pointer-events-none">
          <div className="cyber-laser-stamp" style={{ borderColor: isBombshell ? '#FF1493' : undefined, boxShadow: isBombshell ? '0 0 12px rgba(255,20,147,0.5)' : undefined }}>
            <div className="flex items-center gap-1 opacity-70 mb-0.5">
              <ShieldCheck size={8} style={{ color: accent }} />
              <span className="text-[6px] tracking-wider uppercase font-bold" style={{ color: isBombshell ? '#FF1493' : undefined }}>PRICE</span>
            </div>
            <span 
              className="text-[20px] font-black leading-none"
              style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                color: '#fff',
                textShadow: `0 0 10px ${accent}`,
              }}
            >
              {tier.price === 'FREE' ? 'FREE' : tier.price}
            </span>
          </div>
        </div>

        {/* TOP-RIGHT: Info / Drop Rates Toggle */}
        <div className="absolute right-4 top-11 z-30">
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className="w-7 h-7 rounded flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer"
            style={{
              background: showInfo ? `${accent}` : 'rgba(10,12,20,0.85)',
              color: showInfo ? '#000' : '#fff',
              border: `1px solid ${accent}60`,
              boxShadow: `0 0 10px ${accent}30`,
            }}
          >
            {showInfo ? <X size={14} /> : <Info size={14} />}
          </button>
        </div>

        {/* BOTTOM-RIGHT: Cartridge Capacity Stamp */}
        <div className="absolute right-4 bottom-20 z-30 pointer-events-none">
          <div className="cyber-laser-stamp" style={{ padding: '3px 8px', borderColor: isBombshell ? '#FF1493' : undefined, boxShadow: isBombshell ? '0 0 12px rgba(255,20,147,0.5)' : undefined }}>
            <span className="text-[5px] tracking-wider uppercase opacity-60" style={{ color: isBombshell ? '#FF1493' : undefined }}>CAPACITY</span>
            <span 
              className="text-[16px] font-black leading-none"
              style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                color: '#fff',
                textShadow: isBombshell ? `0 0 8px ${accent}` : undefined,
              }}
            >
              {tier.cardCount}×
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

        {/* CENTER CONTENT */}
        <div className="relative flex flex-col items-center justify-between h-full pt-16 pb-6 px-4 z-10 pointer-events-none">
          <div className="h-2" />

          {/* Central Title & Aperture */}
          <div className="text-center w-full my-auto flex flex-col items-center px-1">
            <h3 
              className={`leading-[0.92] uppercase font-black tracking-wide text-center max-w-[230px] ${
                cfg.label.length > 18 
                  ? 'text-[18px] sm:text-[20px]' 
                  : cfg.label.length > 12 
                    ? 'text-[22px] sm:text-[24px]' 
                    : 'text-[26px] sm:text-[29px]'
              }`}
              style={{
                color: '#ffffff',
                fontFamily: '"Impact", "Arial Black", sans-serif',
                letterSpacing: '0.02em',
                textShadow: `0 0 16px ${accent}, 2px 2px 0 #000`,
                margin: '4px 0 8px 0',
              }}
            >
              {cfg.label}
            </h3>

            {/* Rotating Core Aperture */}
            <CyberApertureEmblem accent={accent} size={82} isBombshell={isBombshell} />

            {/* Tagline Badge */}
            <div className="mt-2 px-3 py-1 rounded bg-black/70 border border-white/10 flex items-center gap-1.5">
              <Cpu size={10} style={{ color: accent }} />
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-slate-300">
                {isBombshell ? '💖 UNCENSORED PANIK ARCHIVE' : variant.tagline}
              </span>
            </div>
          </div>

          {/* Special Proof Guarantee Indicator */}
          {isSpecial && (
            <div className="px-3 py-1 rounded bg-black/80 border border-white/15 my-1">
              <span className="text-[8px] font-mono font-bold" style={{ color: accent }}>
                {category === 'prophecy' ? '🔮 3% PROOF OF FIRST (1/1)' : '🎲 8% HEARD FIRST PROOF'}
              </span>
            </div>
          )}

          {/* Bottom Ripped Count Readout */}
          <div className="flex items-center gap-1.5 opacity-60">
            <Users size={10} style={{ color: accent }} />
            <span className="text-[8px] font-mono text-slate-400">
              {rippedCount.toLocaleString()} breached
            </span>
          </div>
        </div>

        {/* Drop Rates & Info Overlay */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 backdrop-blur-md"
              style={{ background: 'rgba(5,7,12,0.92)' }}
            >
              <h4 className="text-lg font-bold font-mono uppercase text-center mb-3" style={{ color: accent, textShadow: `0 0 10px ${accent}` }}>
                Matrix Rates
              </h4>
              <div className="w-full space-y-2 px-6">
                {['common', 'uncommon', 'rare', 'legendary', 'mythic'].map((r, i) => {
                  const rate = ROLL_RATES[category] ? ROLL_RATES[category][i] : ROLL_RATES.taste[i];
                  if (!rate) return null;
                  const cColor = RARITY_CONFIG[r as keyof typeof RARITY_CONFIG]?.color || '#fff';
                  return (
                    <div key={r} className="flex justify-between items-center text-xs font-mono pb-1 border-b border-white/10">
                      <span className="uppercase font-bold" style={{ color: cColor }}>{r}</span>
                      <span>{rate}%</span>
                    </div>
                  );
                })}
                {PROOF_RATES[category] && (
                  <div className="flex justify-between items-center text-xs font-mono pt-1 mt-1 border-t border-white/20">
                    <span className="uppercase font-bold text-amber-400">1/1 PROOF</span>
                    <span style={{ color: accent }}>{PROOF_RATES[category]}%</span>
                  </div>
                )}
              </div>

              {cfg.description && (
                <div className="mt-4 px-4 text-center border-t border-white/10 pt-2">
                  <p className="text-[10px] font-mono italic text-white/60">
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
            const isSelected = i === activeTierIndex;
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
                  background: isSelected ? accent : 'rgba(12,14,24,0.9)',
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

      {/* Rip / Breach Actuator */}
      {showRipTab && (
        <div 
          className="w-full mt-2 px-1 transition-opacity duration-300"
          style={{ 
            opacity: isActive ? 1 : 0.4, 
            pointerEvents: isActive ? 'auto' : 'none' 
          }}
        >
          <CyberRipTab 
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
