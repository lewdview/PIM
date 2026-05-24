import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { Layers, Flame, Star, Calendar, Zap, Monitor, Clock, Play, Gift, Shield } from 'lucide-react';
import Card from '../components/Card';
import PackShop from '../components/PackShop';
import { useVaultStore } from '../store/useVaultStore';
import { useLoadingToast } from '../store/useLoadingToast';
import { useAuthStore } from '../store/useAuthStore';
import {
  getCardByDay, hasClaimedToday, claimDailyCard,
  purchasePack, getCompletedMonths, getMonthName, getClaimedCountForDay
} from '../services/vaultService';
import { getCurrentDay, getTimeUntilNextDay, formatDate } from '../utils/dayCalc';
import { type PackCategory, type PackSize, RARITY_CONFIG, PACK_CONFIGS } from '../utils/rarity';
import { loadCatalog } from '../game/api';

// ===== BRUTALIST TICKER =====
const TICKER_TEXT = 'TH3V4ULT — 365 DAYS OF RETENTION — COLLECT. SELL. EARN. — DAILY LEVEL UNLOCKS — V⚡ TOKENS — MYTHIC ROLLS — LIVE PLAY — ';

function BrutalistTicker() {
  return (
    <div
      className="w-full overflow-hidden border-y-2 border-black relative"
      style={{ background: '#ffb800', height: '36px' }}
    >
      <div
        className="absolute inset-0 flex items-center whitespace-nowrap"
        style={{ animation: 'ticker-scroll 22s linear infinite' }}
      >
        {[0, 1].map(i => (
          <span
            key={i}
            className="inline-block pr-8"
            style={{
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: '14px',
              fontWeight: 900,
              color: '#000',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              transform: 'scaleY(1.15)',
              transformOrigin: 'center',
            }}
          >
            {TICKER_TEXT}
          </span>
        ))}
      </div>
    </div>
  );
}

// ===== SECTION LABEL =====
function SectionLabel({ label, accent = '#ff3800' }: { label: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1.5 h-8" style={{ background: accent, boxShadow: `0 0 8px ${accent}88` }} />
      <span className="text-[9px] font-mono tracking-[0.4em] uppercase opacity-60">{label}</span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}30, transparent)` }} />
    </div>
  );
}

// ===== STAT STICKER =====
function StatSticker({ icon: Icon, label, value, color, rot }: {
  icon: React.ElementType; label: string; value: string | number; color: string; rot: number;
}) {
  return (
    <div
      className="sticker-gun-tag sticker-slits hover:scale-105 transition-transform cursor-default"
      style={{
        transform: `rotate(${rot}deg)`,
        padding: '10px 18px',
        '--slit-color': `${color}35`,
        minWidth: '155px',
        boxShadow: `4px 4px 0 rgba(0,0,0,0.5)`,
      } as any}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[7px] font-black tracking-widest opacity-45 mb-0.5 flex items-center gap-1 uppercase">
          <Icon size={9} /> {label}
        </span>
        <span
          className="font-black italic tracking-tighter leading-none"
          style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '28px',
            transform: 'scaleY(1.2)',
            transformOrigin: 'center',
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const {
    dailyCard, hasClaimed, tokenBalance, loadVaultData, setDailyCard, setHasClaimed,
    setCollection, startReveal, addToCollection, collection, echoPrestigeScore
  } = useVaultStore();
  const user = useAuthStore(s => s.user);

  const [isClaimingAnimation, setIsClaimingAnimation] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [songId, setSongId] = useState<string | null>(null);
  const [realClaimedCount, setRealClaimedCount] = useState<number>(0);
  const [countdown, setCountdown] = useState(getTimeUntilNextDay());

  // 3D Card Tilt State
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovering, setIsHovering] = useState(false);
  const [isFaceDown, setIsFaceDown] = useState(false);

  const today = getCurrentDay();
  const completedMonths = getCompletedMonths();

  // Mouse tilt helper
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  const flipRotation = isFaceDown ? 180 : 0;
  const rotateX = isHovering ? (mousePos.y - 0.5) * -20 : 0;
  const rotateY = (isHovering ? (mousePos.x - 0.5) * 20 : 0) + flipRotation;

  // Countdown clock loop
  useEffect(() => {
    const interval = setInterval(() => setCountdown(getTimeUntilNextDay()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch daily card and match it with game level
  useEffect(() => {
    async function load() {
      const card = await getCardByDay(today);
      setDailyCard(card);
      const claimedStr = await hasClaimedToday(today);
      setHasClaimed(claimedStr);
      await loadVaultData();
      
      // Load claimed counts
      getClaimedCountForDay(today).then(setRealClaimedCount);

      // Match song catalog
      try {
        const catalog = await loadCatalog();
        const matched = catalog.find(s => s.day === today) || 
                        catalog.find(s => s.id === card?.id) || 
                        catalog.find(s => s.day === (today % (catalog.length || 1))) ||
                        catalog[catalog.length - 1];
        if (matched) {
          setSongId(matched.id);
        }
      } catch (err) {
        console.error('Failed to load catalog for song matching:', err);
      }
    }
    load();
  }, [today, setDailyCard, setHasClaimed, loadVaultData]);

  // Claim action: Claim daily drop -> cinematic reveal -> gameplay levels
  const handleClaim = useCallback(async () => {
    if (hasClaimed) return;

    if (!user) {
      alert('Authentication required: Please connect your wallet first using the "Connect Wallet" button at the top right.');
      return;
    }

    useLoadingToast.getState().show('Claiming daily drop...');
    try {
      const owned = await claimDailyCard(today);
      useLoadingToast.getState().hide();
      if (owned) {
        setIsClaimingAnimation(true);
        addToCollection([owned]);
        setHasClaimed(true);
        startReveal([owned], {
          category: 'daily_claim',
          label: 'Daily Drop',
          icon: '⭐',
          accent: '#ffd700',
          gradient: 'linear-gradient(145deg, #1a1200, #0c0800)',
          price: 'FREE',
          cardCount: 1,
          revealType: 'cinematic',
          redirectPath: songId ? `/play/${songId}` : '/vault/collection',
        });
        setTimeout(() => {
          setIsClaimingAnimation(false);
          setLocation('/vault/reveal');
        }, 800);
      } else {
        alert('Failed to claim daily drop. This can happen if the daily drop has already been claimed or if the server rejected the request. Please try reconnecting your wallet.');
      }
    } catch (err: any) {
      useLoadingToast.getState().hide();
      console.error('Claim daily card threw error:', err);
      alert(`Error claiming daily drop: ${err?.message || err}`);
    }
  }, [today, hasClaimed, setHasClaimed, addToCollection, startReveal, setLocation, songId, user]);

  // Direct play launcher
  const handlePlayNow = useCallback(() => {
    if (songId) {
      setLocation(`/play/${songId}`);
    } else {
      setLocation('/arcade');
    }
  }, [songId, setLocation]);

  // Purchase pack handler
  const handlePurchasePack = useCallback(async (category: PackCategory, size: PackSize, sessionId?: string) => {
    const cfg = PACK_CONFIGS[category];
    const tier = cfg?.tiers.find(t => t.size === size) ?? cfg?.tiers[0];

    // Crypto coinbase flow fallback check
    if (tier && tier.priceValue > 0 && category !== 'vault_token' && tier.price !== 'FREE' && !sessionId) {
      try {
        const { payWithCrypto } = await import('../services/coinbaseService');
        useLoadingToast.getState().show('Waiting for wallet confirmation…');
        const txHash = await payWithCrypto(tier.priceValue);
        
        if (txHash) {
          useLoadingToast.getState().show('Verifying transaction…');
          const cards = await purchasePack(category, size, undefined, txHash);
          if (cards.length > 0) {
            addToCollection(cards);
            startReveal(cards, cfg && tier ? {
              category, size, label: cfg.label, icon: cfg.icon,
              accent: cfg.accent, gradient: cfg.gradient,
              price: tier.price, cardCount: tier.cardCount, revealType: 'cinematic',
            } : undefined);
            setLocation('/vault/reveal');
          }
          return;
        }
      } catch (err: any) {
        console.error('Crypto payment failed:', err);
        useLoadingToast.getState().hide();
        alert(err.message || 'Payment failed');
        return;
      }
    }

    setIsPurchasing(true);
    try {
      useLoadingToast.getState().show('Decrypting pack data…');
      const cards = await purchasePack(category, size, sessionId);
      useLoadingToast.getState().hide();
      if (cards.length > 0) {
        addToCollection(cards);
        startReveal(cards, cfg && tier ? {
          category,
          size,
          label: cfg.label,
          icon: cfg.icon,
          accent: cfg.accent,
          gradient: cfg.gradient,
          price: tier.price,
          cardCount: tier.cardCount,
          revealType: 'cinematic',
        } : undefined);
        setLocation('/vault/reveal');
      }
    } catch (err) {
      console.error('Pack purchase failed:', err);
      useLoadingToast.getState().hide();
    } finally {
      setIsPurchasing(false);
    }
  }, [startReveal, setLocation, addToCollection]);

  // Derived stats
  const uniqueCards = new Set(collection.map(c => c.cardId)).size;
  const totalScore = collection.reduce((sum, c) => sum + (RARITY_CONFIG[c.card.rarity]?.points || 1), 0);
  const proofs = collection.filter(c => c.proof).length;

  return (
    <div className="flex-1 w-full relative bg-[#050402] overflow-hidden">
      {/* SCANLINES & CYBERPUNK STATIC EFFECTS */}
      <div className="scanlines absolute inset-0 opacity-10 pointer-events-none z-10" />
      
      {/* Background ambient neon glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] rounded-full blur-[160px] opacity-10"
          style={{ background: 'radial-gradient(circle, #ff3800, transparent 70%)' }} />
        <div className="absolute bottom-[20%] right-[5%] w-[600px] h-[600px] rounded-full blur-[180px] opacity-[0.08]"
          style={{ background: 'radial-gradient(circle, #ffb800, transparent 70%)' }} />
      </div>

      {/* ===== TICKER ===== */}
      <BrutalistTicker />

      {/* ===== HERO ONBOARDING HEADER ===== */}
      <section className="relative z-10 pt-16 pb-6 text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: -3 }}
          transition={{ duration: 0.6 }}
          className="sticker-gun-tag sticker-slits mb-8"
          style={{
            background: '#ff3800',
            color: '#fff',
            padding: '8px 20px',
            '--slit-color': 'rgba(255,255,255,0.15)',
            boxShadow: '4px 4px 0 #000, 0 0 24px rgba(255,56,0,0.4)',
            transform: 'rotate(-3deg)'
          } as any}
        >
          <span className="text-[11px] font-black tracking-[0.2em] uppercase font-mono">
            TH3V4ULT // NEURAL GATEWAY
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-[44px] sm:text-6xl md:text-8xl brutalist-xl mb-4"
          style={{ '--neon-accent': '#ff3800' } as any}
        >
          TH3V4ULT
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-mono text-[11px] sm:text-xs tracking-[0.3em] uppercase max-w-xl text-center text-[#faf0d8] mb-8 leading-relaxed"
        >
          THE HYBRID FUNNEL ENGINE BY <span className="text-[#ffb800] font-black">TH3SCR1B3</span>. MUSIC UNLOCKS GAMEPLAY · GAMEPLAY UNLOCKS OWNERSHIP · OWNERSHIP UNLOCKS STATUS.
        </motion.p>
      </section>

      {/* ===== HERO ONBOARDING DASHBOARD ===== */}
      <section className="relative z-10 px-4 md:px-8 py-4 max-w-6xl mx-auto mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          
          {/* LEFT: Giant Floating 3D Card and Main Button */}
          <div className="flex flex-col items-center justify-center">
            <SectionLabel label="Today's Drop" accent="var(--color-neon-gold)" />
            
            {dailyCard ? (
              <div
                className="relative flex flex-col items-center justify-center w-full"
                style={{ perspective: '1200px' }}
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => { setIsHovering(false); setMousePos({ x: 0.5, y: 0.5 }); }}
              >
                {/* 3D Rotating Wrapper */}
                <motion.div
                  onClick={() => setIsFaceDown(!isFaceDown)}
                  animate={isHovering ? {
                    rotateX,
                    rotateY,
                    y: -12,
                  } : {
                    rotateX: 0,
                    rotateY: isFaceDown ? 180 : [0, 4, 0, -4, 0],
                    y: [-6, 6, -6],
                  }}
                  transition={isHovering ? {
                    duration: 0.15,
                    ease: 'easeOut',
                  } : {
                    rotateY: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
                    y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
                  }}
                  style={{
                    transformStyle: 'preserve-3d',
                    width: 'min(330px, 80vw)',
                    aspectRatio: '3 / 4',
                    cursor: 'pointer',
                  }}
                  className="relative z-20"
                >
                  {/* Glowing outer halo */}
                  <div className="absolute inset-[-12px] rounded-2xl filter blur-xl opacity-20 group-hover:opacity-30 transition-all duration-300"
                    style={{ background: `radial-gradient(circle, ${RARITY_CONFIG[dailyCard.rarity]?.color || '#ff9900'} 0%, transparent 70%)` }} />

                  {/* Card Shadow */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-8 rounded-full blur-2xl opacity-40"
                    style={{ background: `${RARITY_CONFIG[dailyCard.rarity]?.color || '#ff9900'}40` }} />
                  
                  {/* actual Card element */}
                  <div className="relative w-full h-full rounded-2xl overflow-hidden" style={{
                    border: `2px solid rgba(255,215,0,0.35)`,
                    boxShadow: `
                      0 25px 50px rgba(0,0,0,0.6),
                      0 0 30px ${RARITY_CONFIG[dailyCard.rarity]?.color || '#ff9900'}15,
                      inset 0 0 30px rgba(0,0,0,0.2)
                    `,
                  }}>
                    <Card
                      card={dailyCard}
                      interactive={false}
                      showAudio
                      isDailyOrigin={false}
                    />
                  </div>
                </motion.div>

                {/* Countdown & Action Buttons */}
                <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-[330px] z-30">
                  
                  {/* Digital Countdown Timer */}
                  <div className="sticker-gun-tag sticker-slits drop-shadow-xl w-full" style={{
                    background: '#ffffff',
                    '--slit-color': 'var(--color-neon-gold)',
                    transform: 'rotate(0.5deg)',
                    padding: '8px 16px',
                  } as any}>
                    <div className="flex justify-between items-center px-2">
                      <span className="text-[9px] font-black tracking-wider opacity-60 uppercase flex items-center gap-1.5 text-black">
                        <Clock size={11} className="text-black" /> NEXT RESET
                      </span>
                      <span className="text-xl font-black italic tracking-tighter text-black font-mono">
                        {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
                      </span>
                    </div>
                  </div>

                  {/* Main Funnel CTA */}
                  {!hasClaimed ? (
                    <motion.button
                      whileHover={{ scale: 1.04, rotate: -0.5 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleClaim}
                      className="w-full sticker-gun-tag sticker-slits text-sm uppercase py-4 transition-all drop-shadow-[0_0_25px_rgba(255,184,0,0.4)] cursor-pointer"
                      style={{
                        background: 'linear-gradient(135deg, var(--color-neon-gold), #ff8800)',
                        color: '#000',
                        '--slit-color': 'rgba(0,0,0,0.25)',
                        transform: 'rotate(-1.5deg)',
                      } as any}
                    >
                      <div className="flex flex-col items-center justify-center leading-none">
                        <Gift size={20} className="mb-1" />
                        <span className="font-black text-lg italic uppercase tracking-tighter" style={{ transform: 'scaleY(1.2)' }}>
                          CLAIM CARD & LAUNCH LEVEL
                        </span>
                      </div>
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.04, rotate: 1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handlePlayNow}
                      className="w-full sticker-gun-tag sticker-slits text-sm py-4 transition-all drop-shadow-[0_0_25px_rgba(0,240,255,0.4)] cursor-pointer"
                      style={{
                        background: 'linear-gradient(135deg, var(--color-neon-cyan), #0088ff)',
                        color: '#000',
                        '--slit-color': 'rgba(0,0,0,0.25)',
                        transform: 'rotate(1.5deg)',
                      } as any}
                    >
                      <div className="flex flex-col items-center justify-center leading-none">
                        <Play size={20} className="mb-1 fill-black" />
                        <span className="font-black text-lg italic uppercase tracking-tighter" style={{ transform: 'scaleY(1.2)' }}>
                          PLAY LEVEL NOW
                        </span>
                      </div>
                    </motion.button>
                  )}
                  
                  {/* Claim count */}
                  <div className="text-[10px] font-mono text-[#faf0d8]/40 text-center uppercase tracking-widest mt-1">
                    {realClaimedCount}/100 claimed today • Mythic chance active
                  </div>
                </div>

              </div>
            ) : (
              <div className="w-[330px] aspect-[3/4] border-2 border-white/5 bg-[#0f0d09] flex flex-col items-center justify-center rounded-2xl relative">
                <div className="w-8 h-8 border-2 border-white/10 rounded-full animate-spin mb-4" style={{ borderTopColor: '#ff3800' }} />
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#ff3800]">Syncing Vault Drop...</span>
              </div>
            )}
          </div>

          {/* RIGHT: Stats stickers and balance dashboard */}
          <div className="space-y-6 lg:pl-6">
            
            {/* Stats stickers cluster */}
            <div>
              <SectionLabel label="Your Collection coordinates" accent="var(--color-neon-cyan)" />
              <div className="flex flex-wrap gap-4">
                <StatSticker icon={Layers} label="Total Cards" value={collection.length} color="var(--color-neon-cyan)" rot={-2} />
                <StatSticker icon={Flame} label="Unique Drops" value={`${uniqueCards}/365`} color="var(--color-rarity-uncommon)" rot={1.5} />
                <StatSticker icon={Zap} label="Echo Score" value={echoPrestigeScore} color="var(--color-neon-gold)" rot={-1} />
                {proofs > 0 && (
                  <StatSticker icon={Star} label="Proofs" value={proofs} color="var(--color-neon-purple)" rot={2.5} />
                )}
              </div>
            </div>

            {/* Token Balance widget */}
            <div>
              <SectionLabel label="Token Balance" accent="#ff9900" />
              <div
                className="flex items-center gap-4 border-2 border-black px-5 py-4 w-fit relative overflow-hidden"
                style={{ background: '#0d0d0d', boxShadow: '5px 5px 0 #000' }}
              >
                <div className="scanlines absolute inset-0 opacity-5 pointer-events-none" />
                <Zap size={24} className="animate-pulse" style={{ color: '#ff9900' }} />
                <div>
                  <div className="text-[8px] font-mono uppercase opacity-40 tracking-wider">VAULT TOKENS</div>
                  <div
                    className="font-black leading-none"
                    style={{ fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '38px', color: '#ff9900', letterSpacing: '-1.5px' }}
                  >
                    {tokenBalance.toLocaleString()}
                  </div>
                </div>
                <div className="text-xs font-mono opacity-30 ml-4 font-black">V⚡</div>
              </div>
              <p className="text-[10px] font-mono opacity-40 mt-3 uppercase tracking-wider">
                Burn duplicates in the Forge → earn V⚡ tokens → unlock rare Vault Packs
              </p>
            </div>

            {/* Day counter / archive progress */}
            <div
              className="border-l-4 pl-4 py-3 relative bg-white/[0.01] border-l-[var(--color-neon-gold)] rounded-r-lg p-4"
              style={{ border: '1px solid rgba(255,255,255,0.03)', borderLeft: '4px solid var(--color-neon-gold)' }}
            >
              <div className="text-[8px] font-mono uppercase tracking-widest opacity-40 mb-1.5">Archive progress parameters</div>
              <div className="text-2xl font-black" style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}>
                Day {today} <span className="opacity-45 text-base">/ 365</span>
              </div>
              <div className="mt-3 h-2 w-full bg-[#111] border border-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(today / 365) * 100}%`,
                    background: 'linear-gradient(90deg, var(--color-neon-gold), #ff8800)',
                    boxShadow: '0 0 12px #ffd70055',
                  }}
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Hard divider */}
      <div className="h-px mx-4 md:mx-8 bg-white/5" />

      {/* ===== PACK SHOP ===== */}
      <section className="py-12">
        <div className="px-4 md:px-8 mb-6">
          <SectionLabel label="Pack Shop" accent="var(--color-neon-cyan)" />
          <h2 className="text-[40px] brutalist-xl" style={{ '--neon-accent': 'var(--color-neon-cyan)' } as any}>
            Rip A Pack
          </h2>
        </div>
        <PackShop onPurchase={handlePurchasePack} />
      </section>

      <div className="h-px mx-4 md:mx-8 bg-white/5" />

      {/* ===== THE FORGE CTA ===== */}
      <section className="py-12 px-4 md:px-8">
        <SectionLabel label="The Forge" accent="#ff3800" />
        <motion.div
          whileHover={{ scale: 1.01 }}
          onClick={() => setLocation('/vault/forge')}
          className="relative overflow-hidden cursor-pointer rounded-lg border-2 border-black"
          style={{
            padding: '28px 36px',
            background: 'linear-gradient(135deg, #0d0d0d, #1a0a00)',
            boxShadow: '6px 6px 0 #000, 0 0 45px rgba(255,56,0,0.08)',
          }}
        >
          <div className="scanlines absolute inset-0 opacity-10" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
            <div>
              <h2 style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '36px', textTransform: 'uppercase',
                letterSpacing: '-0.02em', margin: 0,
                background: 'linear-gradient(135deg, #ff3800, #ff9900)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                The Forge
              </h2>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-50 mt-1.5">
                Burn duplicates · Extract V⚡ tokens · Release echoes · Level up card rarity
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="sticker-gun-tag sticker-slits" style={{ background: '#ff9900', color: '#000', padding: '10px 20px', transform: 'rotate(-1deg)', '--slit-color': 'rgba(0,0,0,0.15)' } as any}>
                <span className="text-xs font-black tracking-tight uppercase flex items-center gap-1.5">
                  <Zap size={13} fill="black" /> {tokenBalance} V⚡
                </span>
              </div>
              <span className="text-2xl opacity-40 group-hover:translate-x-1.5 transition-transform">→</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===== MONTH PACKS shelf ===== */}
      {completedMonths.length > 0 && (
        <section className="px-4 md:px-8 py-10">
          <SectionLabel label="Archive Months" accent="var(--color-neon-cyan)" />
          <h2 className="text-[32px] brutalist-xl mb-6" style={{ '--neon-accent': 'var(--color-neon-cyan)' } as any}>
            Month Packs
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none' }}>
            {completedMonths.map((month, i) => (
              <motion.button
                key={month}
                whileHover={{ scale: 1.06, y: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePurchasePack('month', 'single')}
                className="sticker-gun-tag sticker-slits flex-shrink-0"
                style={{
                  transform: `rotate(${i % 2 === 0 ? -1.5 : 1.8}deg)`,
                  padding: '12px 24px',
                  minWidth: '120px',
                  background: '#ffffff',
                  '--slit-color': 'rgba(0,0,0,0.08)',
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
                } as any}
              >
                <div className="flex flex-col items-center">
                  <Calendar size={12} className="opacity-40 mb-1.5" style={{ color: '#000' }} />
                  <div className="text-2xl font-black italic uppercase tracking-tighter" style={{ color: '#000', fontFamily: '"Impact", "Arial Black", sans-serif', transform: 'scaleY(1.2)' }}>
                    {getMonthName(month)}
                  </div>
                  <div className="text-[8px] font-black opacity-45 mt-1 uppercase tracking-widest" style={{ color: '#000' }}>
                    FREE // MONTHLY
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* ===== GEN 0 BANNER ===== */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="px-4 md:px-8 py-10 mb-8"
      >
        <div
          className="sticker-gun-tag sticker-slits p-10 overflow-hidden text-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, #0d0d0d, #050505)',
            border: '3px solid var(--color-neon-gold)',
            '--slit-color': 'rgba(255,215,0,0.08)',
            transform: 'rotate(-0.5deg)',
            boxShadow: '6px 6px 0 rgba(0,0,0,0.8), 0 0 60px rgba(255,215,0,0.12)',
          } as any}
        >
          <div className="scanlines absolute inset-0 opacity-15" />
          <div className="relative z-10 space-y-3">
            <div className="text-[8px] font-mono tracking-[0.5em] uppercase opacity-45">EARLY ACCESS PROTOCOL</div>
            <h3 className="text-6xl brutalist-xl" style={{ '--neon-accent': 'var(--color-neon-gold)' } as any}>
              Generation Zero
            </h3>
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-60 leading-relaxed max-w-sm mx-auto">
              First 100 collectors only.<br />
              <span style={{ color: 'var(--color-neon-gold)', fontWeight: 900 }}>Gen 0 cards are never reminted.</span>
            </p>
          </div>
        </div>
      </motion.section>

      {/* Claim animation overlay */}
      {isClaimingAnimation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-55 flex items-center justify-center bg-black/90"
        >
          <div className="text-center space-y-4">
            <div className="text-6xl animate-bounce">🎉</div>
            <p className="text-3xl brutalist-title" style={{ '--neon-accent': 'var(--color-neon-gold)' } as any}>
              CARD CLAIMED!
            </p>
            <p className="text-sm font-mono text-white/50 tracking-wider">INITIATING DECRYPTOR SEED...</p>
          </div>
        </motion.div>
      )}

      {/* Pack purchase loading overlay */}
      {isPurchasing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-55 flex items-center justify-center bg-black/95"
        >
          <div className="text-center space-y-5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              style={{
                width: '48px', height: '48px', margin: '0 auto',
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: '#ff3800',
                borderRadius: '50%',
              }}
            />
            <div>
              <p style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '20px', textTransform: 'uppercase',
                letterSpacing: '0.15em', color: '#ff3800',
              }}>DECRYPTING ARCHIVE FILE</p>
              <p style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '10px', letterSpacing: '0.2em',
                color: 'rgba(255,255,255,0.3)', marginTop: '6px',
                textTransform: 'uppercase',
              }}>ESTABLISHING COGNITIVE SYNC...</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ===== RETENTION FOOTER BRANDING ===== */}
      <footer className="relative z-10 py-16 border-t border-white/5 bg-[#050402] text-center">
        <div className="max-w-6xl mx-auto px-4 md:px-8 space-y-4">
          <div className="flex justify-center items-center gap-2 text-white/30 text-[10px] font-mono tracking-widest uppercase">
            <Shield size={11} /> Cryptographic Sandbox protocol v1.2.9
          </div>
          <p className="text-[9px] font-mono text-white/40 uppercase max-w-lg mx-auto leading-relaxed">
            th3vault uses cryptographic signatures to anchor ownership coordinates. Under no circumstances should digital audio releases be copied outside authorized node paths.
          </p>
        </div>
      </footer>
    </div>
  );
}
