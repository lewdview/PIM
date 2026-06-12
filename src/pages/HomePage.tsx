import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers, Flame, Star, Calendar, Zap, Gift } from 'lucide-react';
import HeroCard from '../components/HeroCard';
import PackShop from '../components/PackShop';
import SolitaireCanvas from '../components/SolitaireCanvas';
// TokenShop imported no longer since replaced with Forge
import { useVaultStore } from '../store/useVaultStore';
import { useLoadingToast } from '../store/useLoadingToast';
import { useAuthStore } from '../store/useAuthStore';
import {
  getCardByDay, hasClaimedToday, claimDailyCard,
  purchasePack, getCompletedMonths, getMonthName,
  targetedPull, upgradeRarity, fuseDuplicates,
  type OwnedCard,
} from '../services/vaultService';
import { audioManager } from '../game/audio';
import { getCurrentDay } from '../utils/dayCalc';
import { type PackCategory, type PackSize, RARITY_CONFIG, PACK_CONFIGS, type Rarity } from '../utils/rarity';
import { useLocation } from 'wouter';
import PaymentSelectModal from '../components/PaymentSelectModal';

// ===== BRUTALIST TICKER =====
const TICKER_TEXT = 'PIM : TH3V4ULT — 365 DAYS OF DARK AND LIGHT — GEN 0 ARCHIVE — COLLECT. SELL. EARN. — DAILY DROPS — V⚡ TOKEN ECONOMY — RARITY PULLS — MYTHIC POSSIBLE — CLAIM NOW — ';

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
  const [showSolitaire, setShowSolitaire] = useState(false);
  const {
    dailyCard, hasClaimed, tokenBalance, loadVaultData, setDailyCard, setHasClaimed,
    setCollection, startReveal, addToCollection, echoPrestigeScore, collection
  } = useVaultStore();
  const user = useAuthStore(s => s.user);
  const [isClaimingAnimation, setIsClaimingAnimation] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [checkoutInfo, setCheckoutInfo] = useState<{ category: PackCategory; size: PackSize; label: string; price: string; priceValue: number; accent: string } | null>(null);
  const today = getCurrentDay();
  const completedMonths = getCompletedMonths();

  // Token sinks states
  const [targetDay, setTargetDay] = useState('');
  const [targetLoading, setTargetLoading] = useState(false);
  const [upgradeCardId, setUpgradeCardId] = useState('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [fusionLoading, setFusionLoading] = useState(false);
  const [showTargetedPullModal, setShowTargetedPullModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Upgradeable cards (not legendary or mythic)
  const upgradeableCards = useMemo(() =>
    collection.filter(c => c && c.card && !['legendary', 'mythic'].includes(c.card.rarity)),
    [collection]
  );

  // Find fusable groups (3+ identical card_id + rarity)
  const fusableGroups = useMemo(() => {
    const groups: Record<string, OwnedCard[]> = {};
    for (const c of collection) {
      if (!c || !c.card) continue;
      const key = `${c.cardId}-${c.card.rarity}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return Object.entries(groups).filter(([, cards]) => cards.length >= 3);
  }, [collection]);

  // Callbacks for sinks
  const handleTargetedPull = useCallback(async (dayNum: number) => {
    if (!dayNum || dayNum < 1 || dayNum > 365 || tokenBalance < 500) return;
    setTargetLoading(true);
    useLoadingToast.getState().show('Targeted pull…');
    try {
      const card = await targetedPull(dayNum);
      if (card) {
        addToCollection([card]);
        audioManager.playSfx('open_chest', 0.9);
        startReveal([card], {
          category: 'targeted', label: `Targeted Pull: Day ${dayNum}`, icon: '🎯',
          accent: '#ff9900', gradient: 'linear-gradient(145deg, #1a1000, #0a0800)',
          price: '500 V⚡', cardCount: 1, revealType: 'cinematic',
        });
        setLocation('/vault/reveal');
      }
    } catch (err) {
      console.error(err);
    } finally {
      useLoadingToast.getState().hide();
      await loadVaultData();
      setTargetLoading(false);
      setTargetDay('');
    }
  }, [tokenBalance, addToCollection, startReveal, setLocation, loadVaultData]);

  const handleUpgrade = useCallback(async (cardOwnedId: string) => {
    if (!cardOwnedId || tokenBalance < 150) return;
    setUpgradeLoading(true);
    useLoadingToast.getState().show('Upgrading rarity…');
    try {
      const result = await upgradeRarity(cardOwnedId);
      if (result.success) {
        audioManager.playSfx('upgrade', 0.9);
        alert(`Success! Card upgraded to ${result.newRarity?.toUpperCase()}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      useLoadingToast.getState().hide();
      await loadVaultData();
      setUpgradeLoading(false);
      setUpgradeCardId('');
    }
  }, [tokenBalance, loadVaultData]);

  const handleFusion = useCallback(async (cardsToFuse: OwnedCard[]) => {
    if (cardsToFuse.length !== 3) return;
    setFusionLoading(true);
    useLoadingToast.getState().show('Fusing cards…');
    try {
      const card = await fuseDuplicates(cardsToFuse.map(c => c.id));
      if (card) {
        addToCollection([card]);
        audioManager.playSfx('fusion', 0.9);
        startReveal([card], {
          category: 'fusion', label: `Duplicate Fusion`, icon: '🔥',
          accent: '#ff3800', gradient: 'linear-gradient(145deg, #1a0500, #0a0200)',
          price: 'FREE', cardCount: 1, revealType: 'cinematic',
        });
        setLocation('/vault/reveal');
      }
    } catch (err) {
      console.error(err);
    } finally {
      useLoadingToast.getState().hide();
      await loadVaultData();
      setFusionLoading(false);
    }
  }, [addToCollection, startReveal, setLocation, loadVaultData]);

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
        localStorage.setItem("pim_tutorial_redirect_song_id", owned.cardId);
        setHasClaimed(true);
        audioManager.playSfx('open_chest', 0.9);
        const completed = localStorage.getItem("pim_tutorial_completed") === "true";
        const hasClaimedBefore = completed || (collection && collection.length > 0);

        startReveal([owned], {
          category: 'daily_claim',
          label: 'Daily Drop',
          icon: '⭐',
          accent: '#ffd700',
          gradient: 'linear-gradient(145deg, #1a1200, #0c0800)',
          price: 'FREE',
          cardCount: 1,
          revealType: 'cinematic',
          redirectPath: hasClaimedBefore ? `/play/${owned.cardId}` : `/tutorial?songId=${owned.cardId}`,
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
    if (category === 'targeted_pull') {
      setShowTargetedPullModal(true);
      return;
    }
    if (category === 'rarity_upgrade') {
      setShowUpgradeModal(true);
      return;
    }

    const cfg = PACK_CONFIGS[category];
    const tier = cfg?.tiers.find(t => t.size === size) ?? cfg?.tiers[0];

    // ── INTERCEPT FOR USD PACKS (REQUIRES CLEARANCE OPTION) ─────────
    if (tier && tier.priceValue > 0 && category !== 'vault_token' && tier.price !== 'FREE' && !sessionId) {
      setCheckoutInfo({
        category,
        size,
        label: cfg.label,
        price: tier.price,
        priceValue: tier.priceValue,
        accent: cfg.accent,
      });
      return;
    }

    setIsPurchasing(true);
    try {
      useLoadingToast.getState().show('Opening pack…');
      const cards = await purchasePack(category, size, sessionId);
      useLoadingToast.getState().hide();
      if (cards.length > 0) {
        addToCollection(cards);
        await loadVaultData();
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
  }, [startReveal, setLocation, addToCollection, loadVaultData]);

  const handlePaymentSelect = useCallback(async (method: 'crypto' | 'stripe') => {
    if (!checkoutInfo) return;
    const { category, size, priceValue, label, price, accent } = checkoutInfo;
    setCheckoutInfo(null);

    const cfg = PACK_CONFIGS[category];
    const tier = cfg?.tiers.find(t => t.size === size) ?? cfg?.tiers[0];

    if (method === 'crypto') {
      try {
        const { payWithCrypto } = await import('../services/coinbaseService');
        useLoadingToast.getState().show('Waiting for wallet confirmation…');
        
        const txHash = await payWithCrypto(priceValue);
        
        if (txHash) {
          useLoadingToast.getState().show('Verifying transaction…');
          const cards = await purchasePack(category, size, undefined, txHash);
          if (cards.length > 0) {
            addToCollection(cards);
            await loadVaultData();
            const revealType = 'cinematic' as const;
            startReveal(cards, cfg && tier ? {
              category, size, label: cfg.label, icon: cfg.icon,
              accent: cfg.accent, gradient: cfg.gradient,
              price: tier.price, cardCount: tier.cardCount, revealType,
            } : undefined);
            setLocation('/vault/reveal');
          }
        }
      } catch (err: any) {
        console.error('Crypto payment failed:', err);
        useLoadingToast.getState().hide();
        alert(err.message || 'Payment failed');
      }
    } else {
      // Stripe payment simulation redirect
      useLoadingToast.getState().show('Connecting to Stripe checkout...');
      setTimeout(() => {
        const mockSessionId = 'cs_live_mock_' + Math.random().toString(36).substr(2, 9);
        window.location.href = `/?session_id=${mockSessionId}&category=${category}&size=${size}`;
      }, 1200);
    }
  }, [checkoutInfo, startReveal, setLocation, addToCollection, loadVaultData]);

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
                  className="flex items-center gap-3 border-2 border-black px-4 py-3 w-fit cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
                  style={{ background: '#0d0d0d', boxShadow: '4px 4px 0 #000' }}
                  onClick={() => {
                    audioManager.playSfx('open_chest', 0.85);
                    setShowSolitaire(true);
                  }}
                  title="Click to trigger Solitaire Easter Egg!"
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

      {/* ===== V⚡ TOKEN ECONOMY CONSOLE ===== */}
      <section className="py-8 px-4 md:px-8">
        <SectionLabel label="Economy Deck" accent="var(--color-neon-gold)" />
        <div 
          className="relative overflow-hidden"
          style={{
            padding: '24px',
            border: '3px solid #000',
            background: 'linear-gradient(135deg, #120e00, #0a0600)',
            boxShadow: '6px 6px 0 #000, 0 0 40px rgba(255,153,0,0.05)',
          }}
        >
          <div className="scanlines absolute inset-0 opacity-10" />
          <div className="relative z-10">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
              <div>
                <h2 style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif',
                  fontSize: '28px', textTransform: 'uppercase',
                  letterSpacing: '-0.02em', margin: 0,
                  color: 'var(--color-neon-gold)',
                  textShadow: '0 0 10px rgba(255,153,0,0.3)'
                }}>
                  V⚡ Token Sinks Console
                </h2>
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-45 mt-1">
                  Targeted pulls · Instant upgrades · Duplicate fusion
                </p>
              </div>
              <div className="sticker-gun-tag sticker-slits" style={{ background: '#ff9900', color: '#000', padding: '6px 12px', transform: 'rotate(1deg)', '--slit-color': 'rgba(0,0,0,0.15)' } as any}>
                <span className="text-[10px] font-black tracking-tighter uppercase flex items-center gap-1">
                  <Zap size={11} /> {tokenBalance} V⚡ AVAILABLE
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* TARGETED PULL */}
              <div className="border border-black p-4 flex flex-col justify-between" style={{ background: 'rgba(255,255,255,0.02)', border: '2px solid rgba(255,153,0,0.15)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🎯</span>
                    <h3 className="font-bold text-sm uppercase tracking-wider text-white">Targeted Pull</h3>
                  </div>
                  <p className="text-[10px] font-mono opacity-50 mb-4 leading-normal">
                    Choose a specific day to pull a card from that day's pool.
                  </p>
                  
                  <div className="space-y-3 mb-4">
                    <label className="block text-[9px] font-mono uppercase opacity-40">Target Day (1-365)</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="365" 
                      value={targetDay}
                      onChange={(e) => setTargetDay(e.target.value)}
                      placeholder="e.g. 45" 
                      className="w-full bg-black border-2 border-zinc-800 text-white font-mono text-xs p-2 focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-mono uppercase tracking-widest opacity-40 mb-2">Cost: 500 V⚡</div>
                  <button 
                    disabled={targetLoading || !targetDay || parseInt(targetDay) < 1 || parseInt(targetDay) > 365 || tokenBalance < 500}
                    onClick={() => handleTargetedPull(parseInt(targetDay))}
                    className="w-full py-2 bg-[#ff9900] hover:bg-[#e08800] text-black font-black uppercase text-xs tracking-wider transition-all disabled:opacity-30 disabled:hover:bg-[#ff9900]"
                    style={{ border: '2px solid #000', boxShadow: '2px 2px 0 #000' }}
                  >
                    {targetLoading ? 'PULLING...' : 'EXECUTE PULL'}
                  </button>
                </div>
              </div>

              {/* QUICK RARITY UPGRADE */}
              <div className="border border-black p-4 flex flex-col justify-between" style={{ background: 'rgba(255,255,255,0.02)', border: '2px solid rgba(255,153,0,0.15)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">⚡</span>
                    <h3 className="font-bold text-sm uppercase tracking-wider text-white">Rarity Upgrade</h3>
                  </div>
                  <p className="text-[10px] font-mono opacity-50 mb-4 leading-normal">
                    Instantly upgrade any card you own below Legendary tier by +1 tier.
                  </p>

                  <div className="space-y-3 mb-4">
                    <label className="block text-[9px] font-mono uppercase opacity-40">Select Card</label>
                    <select 
                      value={upgradeCardId}
                      onChange={(e) => setUpgradeCardId(e.target.value)}
                      className="w-full bg-black border-2 border-zinc-800 text-white font-mono text-xs p-2 focus:border-amber-500 outline-none"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="">-- Choose Card --</option>
                      {upgradeableCards.map(c => (
                        <option key={c.id} value={c.id}>
                          Day {c.card.day}: {c.card.title} ({c.card.rarity.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-mono uppercase tracking-widest opacity-40 mb-2">Cost: 150 V⚡</div>
                  <button 
                    disabled={upgradeLoading || !upgradeCardId || tokenBalance < 150}
                    onClick={() => handleUpgrade(upgradeCardId)}
                    className="w-full py-2 bg-[#ff9900] hover:bg-[#e08800] text-black font-black uppercase text-xs tracking-wider transition-all disabled:opacity-30 disabled:hover:bg-[#ff9900]"
                    style={{ border: '2px solid #000', boxShadow: '2px 2px 0 #000' }}
                  >
                    {upgradeLoading ? 'UPGRADING...' : 'UPGRADE CARD'}
                  </button>
                </div>
              </div>

              {/* DUPLICATE FUSION */}
              <div className="border border-black p-4 flex flex-col justify-between" style={{ background: 'rgba(255,255,255,0.02)', border: '2px solid rgba(255,153,0,0.15)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🔥</span>
                    <h3 className="font-bold text-sm uppercase tracking-wider text-white">Duplicate Fusion</h3>
                  </div>
                  <p className="text-[10px] font-mono opacity-50 mb-4 leading-normal">
                    Combine 3 identical cards (same day + rarity) into 1 upgraded card.
                  </p>

                  <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {fusableGroups.length === 0 ? (
                      <div className="text-[10px] font-mono opacity-30 text-center py-4">
                        No fusable triplets found.
                      </div>
                    ) : (
                      fusableGroups.map(([key, cards]) => {
                        const first = cards[0];
                        const rc = RARITY_CONFIG[first.card.rarity as Rarity];
                        return (
                          <div key={key} className="flex items-center justify-between p-2 border border-zinc-800 bg-black/40">
                            <div className="text-[9px] font-mono text-zinc-300">
                              Day {first.card.day}: {first.card.title} 
                              <span className="ml-1 px-1 font-bold" style={{ color: rc?.color || '#fff' }}>
                                {first.card.rarity.toUpperCase()}
                              </span>
                            </div>
                            <button
                              disabled={fusionLoading}
                              onClick={() => handleFusion(cards.slice(0, 3))}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-mono text-[8px] font-bold uppercase transition-all"
                            >
                              FUSE
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-mono uppercase tracking-widest opacity-40 mb-2">Cost: FREE</div>
                  <div className="text-[9px] font-mono opacity-40 text-center py-2">
                    Requires 3 identical cards
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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

      {/* ===== REDEEM CODES CTA ===== */}
      <section className="py-8 px-4 md:px-8">
        <SectionLabel label="Promotions & Decryption" accent="var(--color-neon-gold)" />
        <motion.div
          whileHover={{ scale: 1.01 }}
          onClick={() => setLocation('/vault/claim')}
          className="relative overflow-hidden cursor-pointer"
          style={{
            padding: '24px 32px',
            border: '3px solid #000',
            background: 'linear-gradient(135deg, #0d0d0d, #1a1300)',
            boxShadow: '6px 6px 0 #000, 0 0 40px rgba(255,215,0,0.08)',
          }}
        >
          <div className="scanlines absolute inset-0 opacity-10" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '32px', textTransform: 'uppercase',
                letterSpacing: '-0.02em', margin: 0,
                background: 'linear-gradient(135deg, #ffd700, #ff9900)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Redeem Center
              </h2>
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-45 mt-1">
                Enter promotional codes · Unlock V⚡ tokens · Claim exclusive background skins
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="sticker-gun-tag sticker-slits" style={{ background: '#ffd700', color: '#000', padding: '8px 16px', transform: 'rotate(1.5deg)', '--slit-color': 'rgba(0,0,0,0.15)' } as any}>
                <span className="text-[10px] font-black tracking-tighter uppercase flex items-center gap-1">
                  <Gift size={11} /> Decrypt Code
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

      {checkoutInfo && (
        <PaymentSelectModal
          isOpen={!!checkoutInfo}
          onClose={() => setCheckoutInfo(null)}
          onSelect={handlePaymentSelect}
          packLabel={checkoutInfo.label}
          price={checkoutInfo.price}
          accent={checkoutInfo.accent}
        />
      )}

      {/* ── TARGETED PULL MODAL OVERLAY ──────────────────────────────── */}
      <AnimatePresence>
        {showTargetedPullModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="relative w-full max-w-md border-2 border-black"
              style={{
                background: 'linear-gradient(135deg, #120e00, #0a0600)',
                padding: '24px',
                boxShadow: '8px 8px 0 #000, 0 0 50px rgba(255,153,0,0.15)',
              }}
            >
              <div className="scanlines absolute inset-0 opacity-10 pointer-events-none" />
              <div className="relative z-10 space-y-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black uppercase text-[#ff9900]" style={{ fontFamily: '"Impact", sans-serif' }}>
                      🎯 TARGETED PULL DECRYPTION
                    </h3>
                    <p className="text-[9px] font-mono uppercase tracking-widest opacity-40">VAULT PROTOCOL 0x5D3</p>
                  </div>
                  <button 
                    onClick={() => { audioManager.playSfx('tap_nav', 0.4); setShowTargetedPullModal(false); setTargetDay(''); }}
                    className="text-white hover:text-[#ff9900] font-mono text-xs font-bold uppercase transition-all"
                  >
                    [ ESC ]
                  </button>
                </div>

                <div className="border border-zinc-800 p-4 bg-black/60 space-y-4">
                  <p className="text-[10px] font-mono text-zinc-300 leading-normal">
                    Enter the exact day (1-365) you wish to pull from. Ripping this pack will decrypt 1 card from that day's specific pool.
                  </p>
                  <div className="space-y-2">
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-zinc-400">Target Day Number</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="365" 
                      value={targetDay}
                      onChange={(e) => setTargetDay(e.target.value)}
                      placeholder="e.g. 45" 
                      className="w-full bg-black border-2 border-zinc-800 text-white font-mono text-sm p-3 focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
                  <span className="text-[10px] font-mono uppercase text-zinc-400">Cost: 500 V⚡</span>
                  <span className="text-[10px] font-mono uppercase text-zinc-400">Balance: {tokenBalance} V⚡</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { audioManager.playSfx('tap_nav', 0.4); setShowTargetedPullModal(false); setTargetDay(''); }}
                    className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-mono uppercase text-xs font-bold transition-all border border-black"
                  >
                    CANCEL
                  </button>
                  <button
                    disabled={targetLoading || !targetDay || parseInt(targetDay) < 1 || parseInt(targetDay) > 365 || tokenBalance < 500}
                    onClick={() => {
                      setShowTargetedPullModal(false);
                      handleTargetedPull(parseInt(targetDay));
                    }}
                    className="py-2.5 bg-[#ff9900] hover:bg-[#e08800] text-black font-black uppercase text-xs tracking-wider transition-all disabled:opacity-30 border border-black"
                    style={{ boxShadow: '2px 2px 0 #000' }}
                  >
                    {targetLoading ? 'PULLING...' : 'DECRYPT PULL'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RARITY UPGRADE MODAL OVERLAY ─────────────────────────────── */}
      <AnimatePresence>
        {showUpgradeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg border-2 border-black"
              style={{
                background: 'linear-gradient(135deg, #0f1012, #07080a)',
                padding: '24px',
                boxShadow: '8px 8px 0 #000, 0 0 50px rgba(0,210,255,0.15)',
              }}
            >
              <div className="scanlines absolute inset-0 opacity-10 pointer-events-none" />
              <div className="relative z-10 space-y-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black uppercase text-[#00d2ff]" style={{ fontFamily: '"Impact", sans-serif' }}>
                      ⚡ RARITY UPGRADE MODULE
                    </h3>
                    <p className="text-[9px] font-mono uppercase tracking-widest opacity-40">SELECT TARGET CARD TO UPGRADE TIER</p>
                  </div>
                  <button 
                    onClick={() => { audioManager.playSfx('tap_nav', 0.4); setShowUpgradeModal(false); }}
                    className="text-white hover:text-[#00d2ff] font-mono text-xs font-bold uppercase transition-all"
                  >
                    [ ESC ]
                  </button>
                </div>

                <div className="border border-zinc-800 bg-black/60 p-4">
                  <div className="flex justify-between items-center text-[10px] font-mono uppercase text-zinc-400 mb-2 px-1">
                    <span>Available Cards ({upgradeableCards.length})</span>
                    <span>Cost: 150 V⚡</span>
                  </div>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {upgradeableCards.length === 0 ? (
                      <div className="text-[10px] font-mono opacity-30 text-center py-8">
                        No upgradeable cards found below Legendary.
                      </div>
                    ) : (
                      upgradeableCards.map((c) => {
                        const currentRarity = c.card.rarity;
                        const idx = RARITIES.indexOf(currentRarity);
                        const nextRarity = RARITIES[idx + 1] || currentRarity;
                        const curColor = RARITY_CONFIG[currentRarity]?.color || '#fff';
                        const nextColor = RARITY_CONFIG[nextRarity]?.color || '#fff';

                        return (
                          <div 
                            key={c.id} 
                            className="flex items-center justify-between p-3 border border-zinc-800 bg-black/40 hover:border-cyan-500/50 transition-all"
                          >
                            <div>
                              <div className="text-xs font-bold text-white">
                                Day {c.card.day}: {c.card.title}
                              </div>
                              <div className="text-[9px] font-mono mt-0.5 flex items-center gap-1.5">
                                <span style={{ color: curColor }} className="font-bold">{currentRarity.toUpperCase()}</span>
                                <span className="text-zinc-500">→</span>
                                <span style={{ color: nextColor }} className="font-bold">{nextRarity.toUpperCase()}</span>
                              </div>
                            </div>
                            <button
                              disabled={upgradeLoading || tokenBalance < 150}
                              onClick={() => {
                                setShowUpgradeModal(false);
                                handleUpgrade(c.id);
                              }}
                              className="px-3 py-1.5 bg-[#00d2ff] hover:bg-[#00b2d9] text-black font-black font-mono text-[9px] uppercase transition-all"
                              style={{ border: '1px solid #000', boxShadow: '1.5px 1.5px 0 #000' }}
                            >
                              UPGRADE
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] font-mono uppercase text-zinc-400">Balance: {tokenBalance} V⚡</span>
                  <button
                    onClick={() => { audioManager.playSfx('tap_nav', 0.4); setShowUpgradeModal(false); }}
                    className="px-5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-mono uppercase text-[10px] font-bold transition-all border border-black"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showSolitaire && <SolitaireCanvas onClose={() => setShowSolitaire(false)} />}
      <div className="h-8" />
    </div>
  );
}

