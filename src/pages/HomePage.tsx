import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layers, Flame, Star, Calendar, Zap } from 'lucide-react';
import HeroCard from '../components/HeroCard';
import PackShop from '../components/PackShop';
// TokenShop imported no longer since replaced with Forge
import { useVaultStore } from '../store/useVaultStore';
import { useLoadingToast } from '../store/useLoadingToast';
import { useAuthStore } from '../store/useAuthStore';
import {
  getCardByDay, hasClaimedToday, claimDailyCard,
  purchasePack, getCompletedMonths, getMonthName,
} from '../services/vaultService';
import { audioManager } from '../game/audio';
import { getCurrentDay } from '../utils/dayCalc';
import { type PackCategory, type PackSize, RARITY_CONFIG, PACK_CONFIGS } from '../utils/rarity';
import { useLocation } from 'wouter';

// ===== BRUTALIST TICKER =====
const TICKER_TEXT = 'TH3V4ULT: NOW FEATURING PIM! — 365 DAYS OF DARK AND LIGHT — GEN 0 ARCHIVE — COLLECT. SELL. EARN. — DAILY DROPS — V⚡ TOKEN ECONOMY — RARITY PULLS — MYTHIC POSSIBLE — CLAIM NOW — ';

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

// ===== MAIN PAGE =====
export default function HomePage() {
  const [, setLocation] = useLocation();
  const {
    dailyCard, hasClaimed, tokenBalance, loadVaultData, setDailyCard, setHasClaimed,
    setCollection, startReveal, addToCollection, echoPrestigeScore
  } = useVaultStore();
  const user = useAuthStore(s => s.user);
  const [isClaimingAnimation, setIsClaimingAnimation] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const today = getCurrentDay();
  const completedMonths = getCompletedMonths();

  // Load daily card + sync token balance
  useEffect(() => {
    async function load() {
      const card = await getCardByDay(today);
      setDailyCard(card);
      const claimedStr = await hasClaimedToday(today);
      setHasClaimed(claimedStr);
      await loadVaultData();

      // Check for Stripe success redirect
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const category = params.get('category') as PackCategory;
      const size = params.get('size') as PackSize;

      if (sessionId && category && size) {
        // Clear params to prevent re-trigger on refresh
        window.history.replaceState({}, '', '/');
        handlePurchasePack(category, size, sessionId);
      }
    }
    load();
  }, [today, setDailyCard, setHasClaimed, setCollection, loadVaultData]);

  const handleClaim = useCallback(async () => {
    if (hasClaimed) return;

    if (!user) {
      alert('Authentication required: Please connect your wallet first using the "Connect Wallet" button at the top right.');
      return;
    }

    useLoadingToast.getState().show('Claiming daily card…');
    try {
      const owned = await claimDailyCard(today);
      useLoadingToast.getState().hide();
      if (owned) {
        setIsClaimingAnimation(true);
        addToCollection([owned]);
        setHasClaimed(true);
        audioManager.playSfx('open_chest', 0.9);
        startReveal([owned], {
          category: 'daily_claim',
          label: 'Daily Drop',
          icon: '⭐',
          accent: '#ffd700',
          gradient: 'linear-gradient(145deg, #1a1200, #0c0800)',
          price: 'FREE',
          cardCount: 1,
          revealType: 'cinematic',
          redirectPath: '/tutorial',
        });
        setTimeout(() => {
          setIsClaimingAnimation(false);
          setLocation('/vault/reveal');
        }, 800);
      } else {
        alert('Failed to claim daily card. This can happen if the daily drop has already been claimed or if the server rejected the request. Please try reconnecting your wallet.');
      }
    } catch (err: any) {
      useLoadingToast.getState().hide();
      console.error('Claim daily card threw error:', err);
      alert(`Error claiming daily drop: ${err?.message || err}`);
    }
  }, [today, hasClaimed, setHasClaimed, addToCollection, startReveal, setLocation, user]);

  const handlePurchasePack = useCallback(async (category: PackCategory, size: PackSize, sessionId?: string) => {
    const cfg = PACK_CONFIGS[category];
    const tier = cfg?.tiers.find(t => t.size === size) ?? cfg?.tiers[0];

    // ── CRYPTO PAYMENT FOR USD PACKS (COINBASE SDK) ─────────────────
    if (tier && tier.priceValue > 0 && category !== 'vault_token' && tier.price !== 'FREE' && !sessionId) {
      try {
        const { payWithCrypto } = await import('../services/coinbaseService');
        useLoadingToast.getState().show('Waiting for wallet confirmation…');
        
        // Use the priceValue from the tier (e.g. 5.00 for Prophecy)
        const txHash = await payWithCrypto(tier.priceValue);
        
        if (txHash) {
          useLoadingToast.getState().show('Verifying transaction…');
          // Once we have txHash, we can proceed to purchasePack
          const cards = await purchasePack(category, size, undefined, txHash);
          if (cards.length > 0) {
            addToCollection(cards);
            const revealType = 'cinematic' as const;
            startReveal(cards, cfg && tier ? {
              category, size, label: cfg.label, icon: cfg.icon,
              accent: cfg.accent, gradient: cfg.gradient,
              price: tier.price, cardCount: tier.cardCount, revealType,
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
      useLoadingToast.getState().show('Opening pack…');
      const cards = await purchasePack(category, size, sessionId);
      useLoadingToast.getState().hide();
      if (cards.length > 0) {
        addToCollection(cards);
        const revealType = 'cinematic' as const;
        audioManager.playSfx('open_chest', 0.9);
        startReveal(cards, cfg && tier ? {
          category,
          size,
          label: cfg.label,
          icon: cfg.icon,
          accent: cfg.accent,
          gradient: cfg.gradient,
          price: tier.price,
          cardCount: tier.cardCount,
          revealType,
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

  const collection = useVaultStore.getState().collection;
  const uniqueCards = new Set(collection.map(c => c.cardId)).size;
  const totalScore = collection.reduce((sum, c) => sum + (RARITY_CONFIG[c.card.rarity]?.points || 1), 0);
  const proofs = collection.filter(c => c.proof).length;

  return (
    <div className="flex-1 w-full">
      {/* ===== TICKER ===== */}
      <BrutalistTicker />

      {/* ===== HERO SPLIT — Card + Claim ===== */}
      <section className="relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-15"
            style={{ background: 'radial-gradient(ellipse, #ff380040, transparent 70%)' }} />
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 lg:gap-12 items-start">

            {/* LEFT: Hero card */}
            <div>
              <SectionLabel label="Today's Drop" accent="var(--color-neon-gold)" />
              {dailyCard && (
                <HeroCard
                  card={dailyCard}
                  hasClaimed={hasClaimed}
                  onClaim={handleClaim}
                  day={today}
                />
              )}
            </div>

            {/* RIGHT: Stats + Claim rail */}
            <div className="space-y-5 lg:pt-12">

              {/* Stats stickers cluster */}
              <div>
                <SectionLabel label="Vault Stats" accent="var(--color-neon-cyan)" />
                <div className="flex flex-wrap gap-3">
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
                  className="flex items-center gap-3 border-2 border-black px-4 py-3 w-fit"
                  style={{ background: '#0d0d0d', boxShadow: '4px 4px 0 #000' }}
                >
                  <Zap size={20} style={{ color: '#ff9900' }} />
                  <div>
                    <div className="text-[8px] font-mono uppercase opacity-40 tracking-wider">VAULT TOKENS</div>
                    <div
                      className="font-black leading-none"
                      style={{ fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '32px', color: '#ff9900', letterSpacing: '-1px' }}
                    >
                      {tokenBalance.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono opacity-30 ml-2">V⚡</div>
                </div>
                <p className="text-[9px] font-mono opacity-35 mt-2">Sell cards → earn tokens → buy Vault Packs</p>
              </div>

              {/* Day counter / archive info */}
              <div
                className="border-l-4 pl-4 py-2"
                style={{ borderColor: 'var(--color-neon-gold)' }}
              >
                <div className="text-[8px] font-mono uppercase tracking-widest opacity-40 mb-1">Archive Progress</div>
                <div className="text-xl font-black" style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}>
                  Day {today} <span className="opacity-40 text-base">/ 365</span>
                </div>
                <div className="mt-2 h-1.5 w-full" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${(today / 365) * 100}%`,
                      background: 'linear-gradient(90deg, var(--color-neon-gold), #ffaa00)',
                      boxShadow: '0 0 8px #ffd70055',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hard divider */}
      <div className="h-px mx-4 md:mx-8" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* ===== PACK SHOP ===== */}
      <section className="py-6">
        <div className="px-4 md:px-8 mb-4">
          <SectionLabel label="Pack Shop" accent="var(--color-neon-cyan)" />
          <h2 className="text-[40px] brutalist-xl" style={{ '--neon-accent': 'var(--color-neon-cyan)' } as any}>
            Rip A Pack
          </h2>
        </div>
        <PackShop onPurchase={handlePurchasePack} />
      </section>

      <div className="h-px mx-4 md:mx-8" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* ===== THE FORGE CTA ===== */}
      <section className="py-8 px-4 md:px-8">
        <SectionLabel label="The Forge" accent="#ff3800" />
        <motion.div
          whileHover={{ scale: 1.01 }}
          onClick={() => setLocation('/vault/forge')}
          className="relative overflow-hidden cursor-pointer"
          style={{
            padding: '24px 32px',
            border: '3px solid #000',
            background: 'linear-gradient(135deg, #0d0d0d, #1a0a00)',
            boxShadow: '6px 6px 0 #000, 0 0 40px rgba(255,56,0,0.08)',
          }}
        >
          <div className="scanlines absolute inset-0 opacity-10" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '32px', textTransform: 'uppercase',
                letterSpacing: '-0.02em', margin: 0,
                background: 'linear-gradient(135deg, #ff3800, #ff9900)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                The Forge
              </h2>
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-45 mt-1">
                Burn cards · Earn V⚡ · Release echoes · Track upgrades
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="sticker-gun-tag sticker-slits" style={{ background: '#ff9900', color: '#000', padding: '8px 16px', transform: 'rotate(-1deg)', '--slit-color': 'rgba(0,0,0,0.15)' } as any}>
                <span className="text-[10px] font-black tracking-tighter uppercase flex items-center gap-1">
                  <Zap size={11} /> {tokenBalance} V⚡
                </span>
              </div>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '20px', opacity: 0.3 }}>→</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===== MONTH PACKS shelf ===== */}
      {completedMonths.length > 0 && (
        <section className="px-4 md:px-8 py-8">
          <SectionLabel label="Archive Months" accent="var(--color-neon-cyan)" />
          <h2 className="text-[32px] brutalist-xl mb-5" style={{ '--neon-accent': 'var(--color-neon-cyan)' } as any}>
            Month Packs
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
            {completedMonths.map((month, i) => (
              <motion.button
                key={month}
                whileHover={{ scale: 1.06, y: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePurchasePack('month', 'single')}
                className="sticker-gun-tag sticker-slits flex-shrink-0"
                style={{
                  transform: `rotate(${i % 2 === 0 ? -1.5 : 1.8}deg)`,
                  padding: '10px 20px',
                  minWidth: '110px',
                  background: '#ffffff',
                  '--slit-color': 'rgba(0,0,0,0.08)',
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
                } as any}
              >
                <div className="flex flex-col items-center">
                  <Calendar size={10} className="opacity-40 mb-1" style={{ color: '#000' }} />
                  <div className="text-2xl font-black italic uppercase tracking-tighter" style={{ color: '#000', fontFamily: '"Impact", "Arial Black", sans-serif', transform: 'scaleY(1.2)' }}>
                    {getMonthName(month)}
                  </div>
                  <div className="text-[7px] font-black opacity-35 mt-0.5 uppercase tracking-widest" style={{ color: '#000' }}>
                    FREE // RC1
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      <div className="h-px mx-4 md:mx-8" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* ===== GEN 0 BANNER ===== */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="px-4 md:px-8 py-8 mb-4"
      >
        <div
          className="sticker-gun-tag sticker-slits p-10 overflow-hidden text-center"
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
            <div className="text-[8px] font-mono tracking-[0.5em] uppercase opacity-40">Early Access</div>
            <h3 className="text-6xl brutalist-xl" style={{ '--neon-accent': 'var(--color-neon-gold)' } as any}>
              Generation Zero
            </h3>
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-50 leading-relaxed max-w-sm mx-auto">
              First 100 collectors only.<br />
              <span style={{ color: 'var(--color-neon-gold)', fontWeight: 900 }}>Gen 0 cards never reminted.</span>
            </p>
          </div>
        </div>
      </motion.section>

      {/* Claim animation overlay */}
      {isClaimingAnimation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)' }}
        >
          <div className="text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <p className="text-2xl brutalist-title" style={{ '--neon-accent': 'var(--color-neon-gold)' } as any}>Card Claimed!</p>
            <p className="text-sm font-mono" style={{ color: 'var(--color-text-muted)' }}>Revealing…</p>
          </div>
        </motion.div>
      )}

      {/* Pack purchase loading overlay */}
      {isPurchasing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
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
              }}>Decrypting Assets</p>
              <p style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '10px', letterSpacing: '0.2em',
                color: 'rgba(255,255,255,0.3)', marginTop: '6px',
                textTransform: 'uppercase',
              }}>Connecting to vault engine…</p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="h-8" />
    </div>
  );
}


