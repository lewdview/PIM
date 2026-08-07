import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import {
  Layers, Flame, Star, Calendar, Zap, Play, Gift, Shield, Sparkles,
  AlertTriangle, Lock, Award, CheckCircle2, ChevronLeft, ChevronRight, X, Clock, HelpCircle,
  Terminal, Image as ImageIcon, ChevronDown
} from 'lucide-react';
import Card from '../components/Card';
import { PackBag } from '../components/PackShop';
import { VendingMarqueeSVG, SidePanelGraphicSVG, VendingCoilSVG, RetrievalChuteDoorSVG, OverheadClawSVG, VendingInspectorWindowSVG, VendingCoinSlotSVG, VendingKeypadSVG } from '../components/VendingMachineGraphics';
import { useVaultStore } from '../store/useVaultStore';
import { useLoadingToast } from '../store/useLoadingToast';
import { useAuthStore } from '../store/useAuthStore';
import {
  getCardByDay, hasClaimedToday, claimDailyCard,
  purchasePack, getCompletedMonths, getMonthName, getClaimedCountForDay,
  targetedPull, upgradeRarity, fuseDuplicates,
  redeemBonusCode, fetchAllCards, findCardWithFallback,
  hasClaimedFreePackToday,
  type OwnedCard
} from '../services/vaultService';
import { audioManager } from '../game/audio';
import { getCurrentDay, getTimeUntilNextDay } from '../utils/dayCalc';
import { type PackCategory, type PackSize, PACK_CONFIGS, PACK_CAROUSEL_ORDER, ROLL_RATES, PROOF_RATES } from '../utils/rarity';
import { loadCatalog } from '../game/api';
import { payWithCrypto } from '../services/coinbaseService';

// ===== MODERN FLOATING ANNOUNCEMENT BAR =====
const TICKER_TEXT = '⚡ PIM : TH3V4ULT • DAILY MUSIC DROPS • COLLECT & EARN TOKENS • VERIFIABLE AUDIO PROOFS';

function FloatingAnnouncementBar() {
  return (
    <div className="w-full flex justify-center pt-6 pb-2 relative z-20 pointer-events-none px-4">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex items-center gap-3 px-5 py-2 rounded-full border border-blue-500/20 backdrop-blur-xl shadow-[0_4px_30px_rgba(59,130,246,0.15)]"
        style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.7), rgba(30, 41, 59, 0.5))' }}
      >
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
        </span>
        <span className="text-[10px] md:text-xs font-semibold tracking-widest text-blue-100 uppercase truncate">
          {TICKER_TEXT}
        </span>
      </motion.div>
    </div>
  );
}

// ===== SECTION LABEL =====
function SectionLabel({ label, accent = '#3b82f6' }: { label: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1.5 h-6 rounded-full" style={{ background: accent, boxShadow: `0 0 12px ${accent}` }} />
      <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-slate-300">{label}</span>
      <div className="flex-1 h-[1px]" style={{ background: `linear-gradient(90deg, ${accent}50, transparent)` }} />
    </div>
  );
}

// ===== STAT STICKER =====
function StatSticker({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      className="flex flex-col p-4 rounded-2xl border border-white/10 backdrop-blur-md relative overflow-hidden group cursor-default"
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
        boxShadow: `0 8px 32px 0 ${color}10`,
      }}
    >
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-25 pointer-events-none"
        style={{ background: color }} />
      <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider opacity-70 mb-2 uppercase text-slate-300">
        <Icon size={14} style={{ color }} /> {label}
      </div>
      <span className="text-3xl font-extrabold tracking-tight text-white">
        {value}
      </span>
    </motion.div>
  );
}

export default function NextGenLandingPage() {
  const [, setLocation] = useLocation();
  const {
    dailyCard, hasClaimed, tokenBalance, loadVaultData, setDailyCard, setHasClaimed,
    startReveal, addToCollection, removeFromCollection, collection, echoPrestigeScore
  } = useVaultStore();
  const user = useAuthStore(s => s.user);

  const [isClaimingAnimation, setIsClaimingAnimation] = useState(false);

  // Token sinks states
  const [targetDay, setTargetDay] = useState('');
  const [targetLoading, setTargetLoading] = useState(false);
  const [upgradeCardId, setUpgradeCardId] = useState('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [fusionLoading, setFusionLoading] = useState(false);
  const [showTargetedPullModal, setShowTargetedPullModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Bonus Code States
  const [bonusCode, setBonusCode] = useState('');
  const [codeState, setCodeState] = useState<'idle' | 'redeeming' | 'success' | 'error'>('idle');
  const [codeError, setCodeError] = useState('');
  const [ageGateCode, setAgeGateCode] = useState<string | null>(null);
  const [ageVerifying, setAgeVerifying] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState<{
    type?: string;
    value?: string;
    details?: any;
  } | null>(null);

  // Vending Machine State
  const [vendingPage, setVendingPage] = useState(0);
  const [bombshellTheme, setBombshellTheme] = useState<'dark' | 'light'>('dark');
  const [isFreePackClaimed, setIsFreePackClaimed] = useState(false);
  const [packTierMap, setPackTierMap] = useState<Record<string, number>>({});
  const [activeInspectorCategory, setActiveInspectorCategory] = useState<PackCategory>('taste');
  const [vendedStack, setVendedStack] = useState<Array<{
    id: string;
    category: PackCategory;
    size: PackSize;
    cards: OwnedCard[];
    meta: {
      label: string;
      icon: string;
      accent: string;
      gradient: string;
      price: string;
      cardCount: number;
    };
  }>>([]);
  const [droppingPack, setDroppingPack] = useState<{ category: PackCategory; label: string; icon: string; accent: string } | null>(null);

  const VENDING_CAROUSEL_CATEGORIES: PackCategory[] = useMemo(() => [
    'free', 'bombshell', 'taste', 'light', 'dark', 'miss_out', 'month', 'special_picks', 'prophecy', 'alpha', 'vault_token'
  ], []);

  const maxVendingPages = VENDING_CAROUSEL_CATEGORIES.length;

  useEffect(() => {
    hasClaimedFreePackToday().then(setIsFreePackClaimed);
  }, []);

  // ArrowLeft & ArrowRight Keyboard Controls for Vending Machine Shelves
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        setVendingPage(prev => (prev === 0 ? maxVendingPages - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setVendingPage(prev => (prev + 1) % maxVendingPages);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maxVendingPages]);

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
    if (tokenBalance < 500) return;
    setTargetLoading(true);
    useLoadingToast.getState().show(`Pulling Day ${dayNum}…`);
    try {
      const card = await targetedPull(dayNum);
      if (card) {
        addToCollection([card]);
        audioManager.playSfx('targeted', 0.9);
        startReveal([card], {
          category: 'targeted', label: `Targeted Pull: Day ${dayNum}`, icon: '🎯',
          accent: '#3b82f6', gradient: 'linear-gradient(145deg, #0a192f, #020c1b)',
          price: '500 V⚡', cardCount: 1, revealType: 'cinematic',
        });
        setShowTargetedPullModal(false);
        setLocation('/vault/reveal');
      }
    } catch (err) {
      console.error(err);
    } finally {
      useLoadingToast.getState().hide();
      await loadVaultData(true);
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
        setShowUpgradeModal(false);
        alert(`Success! Card upgraded to ${result.newRarity?.toUpperCase()}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      useLoadingToast.getState().hide();
      await loadVaultData(true);
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
        cardsToFuse.forEach(c => removeFromCollection(c.id));
        addToCollection([card]);
        audioManager.playSfx('fusion', 0.9);
        startReveal([card], {
          category: 'fusion', label: `Duplicate Fusion`, icon: '🔥',
          accent: '#fbbf24', gradient: 'linear-gradient(145deg, #2a1600, #0a0500)',
          price: 'FREE', cardCount: 1, revealType: 'cinematic',
        });
        setLocation('/vault/reveal');
      }
    } catch (err) {
      console.error(err);
    } finally {
      useLoadingToast.getState().hide();
      await loadVaultData(true);
      setFusionLoading(false);
    }
  }, [addToCollection, removeFromCollection, startReveal, setLocation, loadVaultData]);

  const handleBonusRedeem = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusCode.trim()) return;

    setCodeState('redeeming');
    setCodeError('');
    setRewardClaimed(null);
    useLoadingToast.getState().show('Decrypting bonus code…');

    try {
      const res = await redeemBonusCode(bonusCode);
      useLoadingToast.getState().hide();

      if (res.success && res.rewardType && res.rewardValue) {
        if (res.rewardType === 'age_gate_required') {
          setAgeGateCode(res.rewardValue);
          setBonusCode('');
          return;
        }
        if (res.rewardType === 'pack' && res.result?.cards) {
          const pool = await fetchAllCards();
          const mappedCards = res.result.cards.map((c: any) => {
            const parent = findCardWithFallback(pool, c.card_id, c.rarity);
            return {
              id: c.id || crypto.randomUUID(),
              cardId: parent.id,
              card: { ...parent, rarity: c.rarity },
              source: c.source || 'promo_code',
              claimedAt: c.claimed_at,
              edition: c.edition,
              maxSupply: c.max_supply,
              isEcho: c.is_echo,
              echoGeneration: c.echo_generation,
              echoSourceDay: c.echo_source_day,
              proof: c.proof,
              ultraReward: c.ultra_reward,
              blockchainStatus: c.blockchain_status,
              fingerprint: c.fingerprint
            };
          });
          if (mappedCards.length > 0) {
            addToCollection(mappedCards);
            audioManager.playSfx('open_chest', 0.9);
            startReveal(mappedCards, {
              category: 'promo_code',
              label: 'Promo Pack',
              icon: '🎁',
              accent: '#3b82f6',
              gradient: 'linear-gradient(145deg, #0f172a, #020617)',
              price: 'PROMO',
              cardCount: mappedCards.length,
              revealType: 'cinematic',
              redirectPath: '/next-vault'
            });
            await loadVaultData();
            setLocation('/vault/reveal');
            return;
          }
        }

        if (res.rewardType === 'card' && res.result?.card) {
          const pool = await fetchAllCards();
          const c = res.result.card;
          const parent = findCardWithFallback(pool, c.card_id, c.rarity);
          const mappedCard = {
            id: c.id || crypto.randomUUID(),
            cardId: parent.id,
            card: { ...parent, rarity: c.rarity },
            source: c.source || 'promo_code',
            claimedAt: c.claimed_at,
            edition: c.edition,
            maxSupply: c.max_supply,
            isEcho: c.is_echo,
            echoGeneration: c.echo_generation,
            echoSourceDay: c.echo_source_day,
            proof: c.proof,
            ultraReward: c.ultra_reward,
            blockchainStatus: c.blockchain_status,
            fingerprint: c.fingerprint
          };
          addToCollection([mappedCard]);
          audioManager.playSfx('open_chest', 0.9);
          startReveal([mappedCard], {
            category: 'promo_code',
            label: 'Promo Card',
            icon: '⭐',
            accent: '#3b82f6',
            gradient: 'linear-gradient(145deg, #0f172a, #020617)',
            price: 'PROMO',
            cardCount: 1,
            revealType: 'cinematic',
            redirectPath: '/next-vault'
          });
          await loadVaultData();
          setLocation('/vault/reveal');
          return;
        }

        let details: any = {};
        audioManager.playSfx('song_completion', 0.85);

        if (res.rewardType === 'tokens') {
          details.tokensGranted = parseInt(res.rewardValue, 10);
        } else if (res.rewardType === 'background_skin') {
          details.skinUnlocked = res.rewardValue;
        }

        setRewardClaimed({
          type: res.rewardType,
          value: res.rewardValue,
          details
        });
        setCodeState('success');
        setBonusCode('');
        await loadVaultData();
      } else {
        audioManager.playSfx('error', 0.6);
        setCodeError(res.error || 'Invalid or expired code.');
        setCodeState('error');
      }
    } catch (err: any) {
      useLoadingToast.getState().hide();
      audioManager.playSfx('error', 0.6);
      setCodeError(err.message || 'Verification link failed.');
      setCodeState('error');
    }
  }, [bonusCode, addToCollection, startReveal, setLocation, loadVaultData]);

  const handleAgeVerificationConfirm = useCallback(() => {
    if (!ageGateCode) return;
    setAgeVerifying(true);
    useLoadingToast.getState().show('Verifying age protocol…');
    try {
      localStorage.setItem('opt_18_confirmed', 'true');
      let successMsg = "";
      if (ageGateCode === 'stunnerofthemonthunlock') {
        localStorage.setItem('opt_unlocked_stunner_section', 'true');
        successMsg = "Stunner of the Month Section Unlocked!";
      } else if (ageGateCode === 'freebstella') {
        localStorage.setItem('opt_free_stella_unlocked', 'true');
        localStorage.setItem('opt_unlocked_stunner_section', 'true');
        successMsg = "Stella Luxx Fully Unlocked in Slideshows!";
      }
      
      audioManager.playSfx('song_completion', 0.85);
      setRewardClaimed({
        type: 'age_verification',
        value: ageGateCode,
        details: { skinUnlocked: successMsg }
      });
      setCodeState('success');
      setAgeGateCode(null);
      window.dispatchEvent(new Event('cheat_code_activated'));
    } catch (err: any) {
      alert('Verification error: ' + err.message);
    } finally {
      useLoadingToast.getState().hide();
      setAgeVerifying(false);
    }
  }, [ageGateCode]);

  const [songId, setSongId] = useState<string | null>(null);
  const [realClaimedCount, setRealClaimedCount] = useState<number>(0);
  const [countdown, setCountdown] = useState(getTimeUntilNextDay());

  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovering, setIsHovering] = useState(false);
  const [isFaceDown, setIsFaceDown] = useState(false);

  const today = getCurrentDay();
  const completedMonths = getCompletedMonths();

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  const flipRotation = isFaceDown ? 180 : 0;
  const rotateX = isHovering ? (mousePos.y - 0.5) * -15 : 0;
  const rotateY = (isHovering ? (mousePos.x - 0.5) * 15 : 0) + flipRotation;

  useEffect(() => {
    const interval = setInterval(() => setCountdown(getTimeUntilNextDay()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function load() {
      const card = await getCardByDay(today);
      setDailyCard(card);
      const claimedStr = await hasClaimedToday(today);
      setHasClaimed(claimedStr);
      await loadVaultData();
      getClaimedCountForDay(today).then(setRealClaimedCount);

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

  const handleClaim = useCallback(async () => {
    if (hasClaimed) return;
    if (!user) {
      alert('Authentication required: Please connect your wallet first.');
      return;
    }
    useLoadingToast.getState().show('Claiming daily drop...');
    try {
      const owned = await claimDailyCard(today);
      useLoadingToast.getState().hide();
      if (owned) {
        setIsClaimingAnimation(true);
        addToCollection([owned]);
        localStorage.setItem("pim_tutorial_redirect_song_id", owned.cardId);
        setHasClaimed(true);
        audioManager.playSfx('open_chest', 0.9);
        const completed = localStorage.getItem("pim_tutorial_completed") === "true" || useVaultStore.getState().progression.tutorialCompleted;
        const hasClaimedBefore = completed || (collection && collection.length > 0);

        startReveal([owned], {
          category: 'daily_claim',
          label: 'Daily Drop',
          icon: '⭐',
          accent: '#3b82f6',
          gradient: 'linear-gradient(145deg, #0a192f, #020c1b)',
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
        alert('Failed to claim daily drop.');
      }
    } catch (err: any) {
      useLoadingToast.getState().hide();
      console.error('Claim daily card threw error:', err);
      alert(`Error claiming daily drop: ${err?.message || err}`);
    }
  }, [today, hasClaimed, setHasClaimed, addToCollection, startReveal, setLocation, user]);

  const handlePlayNow = useCallback(() => {
    if (songId) {
      setLocation(`/play/${songId}`);
    } else {
      setLocation('/arcade');
    }
  }, [songId, setLocation]);

  const triggerVendDrop = useCallback((category: PackCategory, size: PackSize, cards: OwnedCard[], cfg: any, tier: any) => {
    audioManager.playSfx('open_case', 0.9);
    setDroppingPack({
      category,
      label: cfg?.label || category,
      icon: cfg?.icon || '📦',
      accent: cfg?.accent || '#3b82f6',
    });

    setTimeout(() => {
      setDroppingPack(null);
      setVendedStack(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          category,
          size,
          cards,
          meta: {
            label: cfg?.label || category,
            icon: cfg?.icon || '📦',
            accent: cfg?.accent || '#3b82f6',
            gradient: cfg?.gradient || 'linear-gradient(145deg, #0a192f, #020c1b)',
            price: tier?.price || 'FREE',
            cardCount: cards.length,
          }
        }
      ]);
    }, 650);
  }, []);

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

    if (tier && tier.priceValue > 0 && category !== 'vault_token' && tier.price !== 'FREE' && !sessionId) {
      try {
        useLoadingToast.getState().show('Waiting for wallet confirmation…');
        const txHash = await payWithCrypto(tier.priceValue);
        
        if (txHash) {
          useLoadingToast.getState().show('Verifying transaction…');
          const cards = await purchasePack(category, size, undefined, txHash);
          if (cards.length > 0) {
            addToCollection(cards);
            await loadVaultData();
            triggerVendDrop(category, size, cards, cfg, tier);
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

    try {
      useLoadingToast.getState().show('Vending pack from machine…');
      const cards = await purchasePack(category, size, sessionId);
      useLoadingToast.getState().hide();
      if (cards.length > 0) {
        addToCollection(cards);
        await loadVaultData();
        triggerVendDrop(category, size, cards, cfg, tier);
      }
    } catch (err) {
      console.error('Pack purchase failed:', err);
      useLoadingToast.getState().hide();
    }
  }, [triggerVendDrop, addToCollection, loadVaultData]);

  const handleOpenAllVendedPacks = useCallback(() => {
    if (vendedStack.length === 0) return;
    const allCards = vendedStack.flatMap(item => item.cards);
    const lastItem = vendedStack[vendedStack.length - 1];

    audioManager.playSfx('by_th3scr1b3', 0.9);
    startReveal(allCards, {
      category: lastItem.category,
      size: lastItem.size,
      label: vendedStack.length === 1 ? lastItem.meta.label : `${vendedStack.length} Vended Packs Stack`,
      icon: vendedStack.length === 1 ? lastItem.meta.icon : '🎰',
      accent: '#3b82f6',
      gradient: 'linear-gradient(145deg, #0a192f, #020c1b)',
      price: `${vendedStack.length} Packs`,
      cardCount: allCards.length,
      revealType: 'cinematic',
    });
    setVendedStack([]);
    setLocation('/vault/reveal');
  }, [vendedStack, startReveal, setLocation]);

  const uniqueCards = new Set(collection.map(c => c.cardId)).size;
  const proofs = collection.filter(c => c.proof).length;

  const currentCategoryKey = VENDING_CAROUSEL_CATEGORIES[vendingPage] || 'bombshell';
  const currentCategoryConfig = PACK_CONFIGS[currentCategoryKey];

  const shelfLevelTiers = useMemo(() => {
    // BOMBSHELL PACK 6-TIER SHELF
    if (currentCategoryKey === 'bombshell') {
      const cfg = currentCategoryConfig;
      const baseTiers = cfg?.tiers || [];
      return baseTiers.map(t => ({
        category: 'bombshell' as PackCategory,
        size: t.size as PackSize,
        levelLabel: `${t.cardCount} ${t.cardCount === 1 ? 'CARD' : 'CARDS'}`,
        cardCount: t.cardCount,
        price: t.price,
        coverImage: bombshellTheme === 'light' && (t as any).lightCoverImage ? (t as any).lightCoverImage : (t as any).coverImage,
      }));
    }

    // SPECIAL COMBINED TOKEN SECTION SHELF
    if (currentCategoryKey === 'vault_token') {
      return [
        { category: 'vault_token' as PackCategory, size: 'single' as PackSize, levelLabel: 'VAULT PACK', cardCount: 3, price: '275 V⚡' },
        { category: 'targeted_pull' as PackCategory, size: 'single' as PackSize, levelLabel: 'TARGETED PULL', cardCount: 1, price: '500 V⚡' },
        { category: 'rarity_upgrade' as PackCategory, size: 'single' as PackSize, levelLabel: 'RARITY UPGRADE', cardCount: 1, price: '150 V⚡' },
        { category: 'vault_token' as PackCategory, size: 'triple' as PackSize, levelLabel: 'DUPLICATE FUSION', cardCount: 1, price: '200 V⚡' },
      ];
    }

    const cfg = currentCategoryConfig;
    if (!cfg) return [null, null, null, null];
    const baseTiers = cfg.tiers || [];

    // Return 4 slots representing physical 2, 5, 15 card packs (or null for empty slots)
    return [0, 1, 2, 3].map(i => {
      const tier = baseTiers[i];
      if (!tier) return null;
      return {
        category: currentCategoryKey,
        size: tier.size as PackSize,
        levelLabel: `${tier.cardCount} CARDS`,
        cardCount: tier.cardCount,
        price: tier.price,
      };
    });
  }, [currentCategoryKey, currentCategoryConfig, bombshellTheme]);

  const handleLeverPull = () => {
    setVendingPage(prev => (prev + 1) % maxVendingPages);
  };

  return (
    <div className="flex-1 w-full relative bg-[#070a12] text-slate-100 overflow-hidden font-sans min-h-screen pb-24">
      
      {/* Premium Ambient Background Spheres */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[5%] left-[10%] w-[650px] h-[650px] rounded-full blur-[180px] opacity-25"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
        <div className="absolute bottom-[20%] right-[5%] w-[550px] h-[550px] rounded-full blur-[160px] opacity-20"
          style={{ background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)' }} />
        <div className="absolute top-[40%] right-[30%] w-[400px] h-[400px] rounded-full blur-[140px] opacity-15"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.025] mix-blend-overlay" />
      </div>

      <FloatingAnnouncementBar />

      {/* ===== HERO HEADERS ===== */}
      <section className="relative z-10 pt-8 pb-4 px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Protocol Season 1
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Live Vault
            </span>
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-extrabold tracking-tighter text-white leading-none"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            BEATSTAR <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-200 to-amber-300">VAULT</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-sm font-semibold tracking-wider text-slate-400 mt-3 uppercase"
          >
            Playable music · verifiable ownership · exclusive daily drops
          </motion.p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setLocation('/hero')}
            className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-xs font-bold tracking-wider text-slate-200 hover:text-white hover:border-white/20 transition-all flex items-center gap-2"
          >
            <Sparkles size={14} className="text-amber-400" />
            Museum Exhibit
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setLocation('/arcade')}
            className="px-4 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 backdrop-blur-md text-xs font-bold tracking-wider text-blue-300 hover:bg-blue-500/20 transition-all flex items-center gap-2"
          >
            <Play size={14} className="fill-blue-300" />
            Arcade Mode
          </motion.button>
        </div>
      </section>

      {/* ===== MAIN DASHBOARD ===== */}
      <section className="relative z-10 px-6 py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-start">
          
          {/* LEFT: 3D Card and Claim Flow */}
          <div className="flex flex-col items-center">
            <SectionLabel label="Today's Drop" accent="#fbbf24" />
            
            {dailyCard ? (
              <div
                className="relative flex flex-col items-center justify-center w-full group"
                style={{ perspective: '1200px' }}
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => { setIsHovering(false); setMousePos({ x: 0.5, y: 0.5 }); }}
              >
                <motion.div
                  onClick={() => setIsFaceDown(!isFaceDown)}
                  animate={isHovering ? { rotateX, rotateY, y: -10 } : { rotateX: 0, rotateY: isFaceDown ? 180 : [0, 2, 0, -2, 0], y: [-4, 4, -4] }}
                  transition={isHovering ? { duration: 0.2, ease: 'easeOut' } : { rotateY: { duration: 10, repeat: Infinity, ease: 'easeInOut' }, y: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}
                  style={{ transformStyle: 'preserve-3d', width: 'min(360px, 85vw)', aspectRatio: '3 / 4', cursor: 'pointer' }}
                  className="relative z-20"
                >
                  <div className="absolute inset-[-15px] rounded-3xl filter blur-2xl opacity-30 group-hover:opacity-60 transition-all duration-500"
                    style={{ background: `radial-gradient(circle, #fbbf24 0%, #3b82f6 50%, transparent 80%)` }} />
                  <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.6)] border border-white/20 bg-white/5 backdrop-blur-2xl">
                    <Card card={dailyCard} interactive={false} showAudio isDailyOrigin={false} />
                  </div>
                </motion.div>

                <div className="mt-10 flex flex-col items-center w-full max-w-[360px] z-30 space-y-4">
                  {/* Countdown Timer */}
                  <div className="w-full flex justify-between items-center px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md shadow-lg">
                    <span className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center gap-2">
                      <Clock size={14} className="text-amber-400" /> Next Reset
                    </span>
                    <span className="text-xl font-bold font-mono tracking-tight text-white">
                      {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Main Action Button */}
                  {!hasClaimed ? (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleClaim}
                      className="w-full relative overflow-hidden rounded-2xl p-4 transition-all shadow-[0_0_30px_rgba(251,191,36,0.35)] cursor-pointer bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 text-slate-950 font-extrabold border border-amber-200/60"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <Gift size={24} />
                        <span className="font-extrabold text-lg tracking-tight uppercase">Claim Card & Play</span>
                      </div>
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handlePlayNow}
                      className="w-full relative overflow-hidden rounded-2xl p-4 transition-all shadow-[0_0_30px_rgba(59,130,246,0.35)] cursor-pointer bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 text-white font-extrabold border border-blue-300/60"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <Play size={24} className="fill-white" />
                        <span className="font-extrabold text-lg tracking-tight uppercase">Play Level Now</span>
                      </div>
                    </motion.button>
                  )}
                  <div className="text-xs font-semibold text-slate-400 text-center tracking-wide flex items-center justify-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    {realClaimedCount}/100 claimed today • Mythic drop active
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-[360px] aspect-[3/4] border border-white/10 bg-white/5 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl shadow-xl">
                <div className="w-8 h-8 border-2 border-white/10 rounded-full animate-spin mb-4" style={{ borderTopColor: '#3b82f6' }} />
                <span className="font-semibold text-xs tracking-widest text-blue-400 uppercase">Syncing Vault Card...</span>
              </div>
            )}
          </div>

          {/* RIGHT: Dashboard Stats and Economy */}
          <div className="space-y-8 lg:pl-4">
            
            <div>
              <SectionLabel label="Collection Overview" accent="#3b82f6" />
              <div className="grid grid-cols-2 gap-4">
                <StatSticker icon={Layers} label="Total Cards" value={collection.length} color="#3b82f6" />
                <StatSticker icon={Flame} label="Unique Drops" value={`${uniqueCards}/365`} color="#10b981" />
                <StatSticker icon={Zap} label="Echo Score" value={echoPrestigeScore} color="#fbbf24" />
                <StatSticker icon={Star} label="Audio Proofs" value={proofs} color="#a855f7" />
              </div>
            </div>

            <div>
              <SectionLabel label="Vault Balance" accent="#fbbf24" />
              <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-slate-900/80 to-slate-900/40 border border-white/10 backdrop-blur-xl shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Zap size={28} className="text-amber-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Available Tokens</div>
                    <div className="text-4xl font-extrabold tracking-tight text-white mt-0.5">
                      {tokenBalance.toLocaleString()} <span className="text-xl text-amber-400 font-semibold">V⚡</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handlePurchasePack('vault_token', 'starter')}
                  className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs tracking-wider transition-all"
                >
                  + Get V⚡
                </button>
              </div>
            </div>

            <div>
              <SectionLabel label="Archive Season 1 Progress" accent="#3b82f6" />
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl">
                <div className="flex justify-between items-end mb-3">
                  <div className="text-3xl font-extrabold text-white">
                    Day {today} <span className="text-base text-slate-500 font-medium">/ 365</span>
                  </div>
                  <span className="text-xs font-bold text-blue-400 tracking-widest uppercase">
                    {Math.round((today / 365) * 100)}% Complete
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(today / 365) * 100}%` }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-400 to-amber-400 shadow-[0_0_12px_rgba(59,130,246,0.6)]"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===== ARCHIVE MONTH PACKS (If available) ===== */}
      {completedMonths.length > 0 && (
        <section className="py-10 px-6 max-w-7xl mx-auto relative z-10">
          <SectionLabel label="Archive Vault Months" accent="#3b82f6" />
          <h2 className="text-3xl font-bold text-white tracking-tight mb-6">Completed Months</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
            {completedMonths.map((month) => (
              <motion.button
                key={month}
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePurchasePack('month', 'single')}
                className="flex-shrink-0 p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-blue-500/20 hover:border-blue-400/50 backdrop-blur-md shadow-lg flex flex-col items-center justify-center min-w-[160px]"
              >
                <Calendar size={20} className="text-blue-400 mb-2" />
                <span className="text-lg font-bold text-white uppercase">{getMonthName(month)}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Claim Pack</span>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* ===== PACK SHOP (VENDING MACHINE) ===== */}
      <section className="py-12 relative z-10">
        <div className="px-6 max-w-7xl mx-auto mb-6">
          <SectionLabel label="Vault Shop" accent="#a855f7" />
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Expand Collection</h2>
        </div>
        
        <div className="px-6 max-w-7xl mx-auto">
          {/* Main Vending Machine Cabinet */}
          <div className="relative rounded-[36px] border-[3px] border-slate-700/80 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-[inset_0_20px_50px_rgba(0,0,0,0.9),_0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden">
            
            {/* 1. TOP MARQUEE VECTOR GRAPHIC HEADER (SVG) */}
            <VendingMarqueeSVG />

            <div className="p-4 md:p-6 flex flex-col md:flex-row items-stretch gap-2">
              
              {/* 2. LEFT CYBERPUNK SIDE WRAP GRAPHIC (SVG) */}
              <SidePanelGraphicSVG side="left" />

              {/* CENTER GLASS CHAMBER */}
              <div className="flex-1 rounded-3xl bg-black/85 border border-slate-800 shadow-[inset_0_15px_40px_rgba(0,0,0,0.9)] p-4 md:p-6 relative overflow-hidden min-h-[510px] flex flex-col justify-between">
                {/* Internal Glass Window Glare Reflection */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] via-transparent to-white/[0.04] pointer-events-none" />

                {/* Left & Right Tactile Front Glass Scrolling Buttons */}
                <button
                  onClick={() => {
                    audioManager.playSfx('tap_nav', 0.15);
                    setVendingPage(prev => (prev === 0 ? maxVendingPages - 1 : prev - 1));
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/85 border-2 border-purple-500/70 text-purple-300 hover:text-white hover:border-pink-500 hover:scale-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] backdrop-blur-md group"
                  title="Previous Vending Shelf (Left Arrow)"
                >
                  <ChevronLeft size={24} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => {
                    audioManager.playSfx('tap_nav', 0.15);
                    setVendingPage(prev => (prev + 1) % maxVendingPages);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/85 border-2 border-purple-500/70 text-purple-300 hover:text-white hover:border-pink-500 hover:scale-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] backdrop-blur-md group"
                  title="Next Vending Shelf (Right Arrow)"
                >
                  <ChevronRight size={24} className="group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Digital Monitor Window showing Category Shelf on display */}
                <VendingInspectorWindowSVG 
                  categoryConfig={currentCategoryConfig} 
                  pageIdx={vendingPage} 
                  maxPages={maxVendingPages} 
                />

                {/* Sub-header status inside glass */}
                <div className="flex flex-wrap justify-between items-center mb-4 px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-[10px] font-mono gap-2 relative z-20">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVendingPage(prev => (prev === 0 ? maxVendingPages - 1 : prev - 1))}
                      className="px-2 py-1 rounded bg-purple-950/80 border border-purple-600/60 text-purple-300 hover:bg-purple-800/80 hover:text-white transition-all flex items-center gap-1 font-bold"
                    >
                      <ChevronLeft size={12} /> <span>PREV</span>
                    </button>
                    <span className="text-purple-400 font-bold tracking-widest uppercase">
                      SHELF 0{vendingPage + 1} / 0{maxVendingPages} • {currentCategoryConfig?.label}
                    </span>
                    <button
                      onClick={() => setVendingPage(prev => (prev + 1) % maxVendingPages)}
                      className="px-2 py-1 rounded bg-purple-950/80 border border-purple-600/60 text-purple-300 hover:bg-purple-800/80 hover:text-white transition-all flex items-center gap-1 font-bold"
                    >
                      <span>NEXT</span> <ChevronRight size={12} />
                    </button>
                  </div>

                  {currentCategoryKey === 'bombshell' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-pink-400 font-extrabold tracking-wider uppercase">ARTWORK MODE:</span>
                      <button
                        onClick={() => setBombshellTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
                          bombshellTheme === 'dark'
                            ? 'bg-slate-900 border-pink-500/80 text-pink-300 shadow-[0_0_10px_rgba(255,20,147,0.4)]'
                            : 'bg-amber-950/80 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                        }`}
                      >
                        {bombshellTheme === 'dark' ? '🌙 DARK THEME ARTWORK' : '☀️ LIGHT THEME ARTWORK'}
                      </button>
                    </div>
                  ) : (
                    <span className="text-amber-400 font-bold tracking-wider uppercase">
                      {shelfLevelTiers.length} PACK TIERS ON DISPLAY • CLICK DISPENSE
                    </span>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div 
                    key={`${vendingPage}-${bombshellTheme}`}
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className={`grid ${shelfLevelTiers.length > 4 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'} place-items-center w-full relative z-10`}
                  >
                    {shelfLevelTiers.map((tierItem, idx) => {
                      const slotCode = `${String.fromCharCode(65 + vendingPage)}${idx + 1}`;

                      if (!tierItem) {
                        return (
                          <div key={`empty-${slotCode}`} className="relative flex flex-col items-center w-full select-none">
                            {/* Slot Badge */}
                            <div className="mb-1 flex items-center justify-between w-full max-w-[270px] z-20 opacity-60">
                              <span className="px-3 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-500 font-extrabold tracking-widest">
                                SLOT {slotCode}
                              </span>
                              <span className="text-[9px] font-mono text-slate-600 font-bold uppercase bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                                EMPTY
                              </span>
                            </div>

                            {/* Overhead Claw (holding nothing) */}
                            <OverheadClawSVG accent="#475569" isGrabbing={false} />

                            {/* Empty Slot Glass Cavity */}
                            <div className="relative w-full max-w-[270px] h-[340px] rounded-2xl border-2 border-dashed border-slate-800/80 bg-slate-950/60 flex flex-col items-center justify-center p-6 shadow-inner my-1">
                              <VendingCoilSVG accent="#334155" />
                              <div className="w-14 h-14 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-600 text-2xl mb-2 z-10">
                                🚫
                              </div>
                              <span className="text-xs font-mono font-extrabold text-slate-500 uppercase tracking-widest z-10">
                                EMPTY SLOT
                              </span>
                              <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mt-1 text-center z-10">
                                OUT OF STOCK / UNASSIGNED
                              </span>
                            </div>

                            {/* Disabled Vending Button */}
                            <button
                              disabled
                              className="mt-3 z-10 w-full max-w-[270px] py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-600 font-mono text-[10px] font-bold tracking-widest uppercase cursor-not-allowed flex items-center justify-center gap-1.5 opacity-60"
                            >
                              <span>⛔ EMPTY SLOT ({slotCode})</span>
                            </button>
                          </div>
                        );
                      }

                      const isVendingThisSlot = droppingPack?.category === currentCategoryKey && droppingPack?.size === tierItem.size;

                      return (
                        <div 
                          key={tierItem.levelLabel} 
                          className="relative group flex flex-col items-center w-full"
                        >
                          
                          {/* Slot ID Badge */}
                          <div className="mb-1 flex items-center justify-between w-full max-w-[270px] z-20">
                            <span className="px-3 py-0.5 rounded-full bg-slate-950 border border-slate-700 text-[10px] font-mono text-purple-400 font-extrabold tracking-widest shadow-md">
                              SLOT {slotCode}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 font-bold uppercase bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                              {tierItem.price}
                            </span>
                          </div>

                          {/* OVERHEAD ROBOTIC CLAW SVG (GRIPPING PACK FROM ABOVE) */}
                          <OverheadClawSVG accent={currentCategoryConfig?.accent} isGrabbing={isVendingThisSlot} />

                          {/* PACK CONVEYOR LINE CONTAINER WITH DEPTH STACKING */}
                          <div className="relative w-full flex flex-col items-center">
                            
                            {/* Depth Stacked Pack Queue Behind (Conveyor Track) */}
                            <div className="absolute top-2 w-[240px] h-[330px] rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/60 opacity-40 transform scale-90 translate-y-[-14px] pointer-events-none shadow-2xl flex flex-col items-center justify-end pb-4">
                              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">NEXT IN QUEUE</span>
                            </div>
                            <div className="absolute top-1 w-[255px] h-[345px] rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/80 opacity-70 transform scale-95 translate-y-[-7px] pointer-events-none shadow-xl flex flex-col items-center justify-end pb-3">
                              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">LINE QUEUE</span>
                            </div>

                            {/* Front Foil Pack Bag Component (Dangling from Claw with no bottom rip tab) */}
                            <motion.div 
                              className="relative z-10 drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]"
                              animate={{ y: isVendingThisSlot ? [-4, -20, 0] : [0, 3, 0] }}
                              transition={isVendingThisSlot ? { duration: 0.45 } : { repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                            >
                              <PackBag
                                category={tierItem.category}
                                isActive={true}
                                isFreeClaimed={isFreePackClaimed}
                                showRipTab={false}
                                forcedSize={tierItem.size}
                                onRip={(c, size) => handlePurchasePack(c, tierItem.size)}
                              />
                            </motion.div>
                          </div>

                          {/* Claw Vend / Dispense Button */}
                          <button
                            onClick={() => handlePurchasePack(tierItem.category, tierItem.size)}
                            className="mt-3 z-10 w-full max-w-[270px] py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 border border-white/20 text-white font-mono text-[10px] font-extrabold tracking-widest uppercase hover:brightness-125 transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center gap-1.5"
                          >
                            <span>🤖 DISPENSE ({slotCode} - {tierItem.price})</span>
                          </button>
                        </div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>

                {/* Animated Dropping Pack Effect */}
                <AnimatePresence>
                  {droppingPack && (
                    <motion.div
                      initial={{ y: -150, scale: 1, opacity: 1, rotate: 0 }}
                      animate={{ y: 220, scale: 0.75, opacity: 0.9, rotate: [0, -10, 5, 0] }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.6, ease: "easeIn" }}
                      className="absolute z-50 pointer-events-none flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-amber-400 bg-slate-900 text-white shadow-[0_0_30px_rgba(251,191,36,0.8)]"
                    >
                      <span className="text-4xl">{droppingPack.icon}</span>
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300 mt-1">{droppingPack.label}</span>
                      <span className="text-[9px] font-mono text-slate-300 uppercase">DISPENSING TO CHUTE…</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 2. RIGHT CYBERPUNK SIDE WRAP GRAPHIC (SVG) */}
              <SidePanelGraphicSVG side="right" />

              {/* Mechanical Control Keypad Column */}
              <div className="w-full md:w-48 flex flex-col items-center justify-between p-4 rounded-3xl bg-slate-950 border border-slate-800 shadow-xl shrink-0 gap-4">
                
                {/* Arcade Coin Mechanism Insert Plate SVG */}
                <VendingCoinSlotSVG />

                {/* Directional Scroll Arcade Push Buttons */}
                <div className="flex items-center gap-2 w-full justify-between">
                  <button
                    onClick={() => {
                      audioManager.playSfx('tap_nav', 0.15);
                      setVendingPage(prev => (prev === 0 ? maxVendingPages - 1 : prev - 1));
                    }}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-b from-purple-800 via-purple-900 to-slate-950 border border-purple-400/50 text-purple-200 hover:text-white font-mono text-[10px] font-black tracking-wider uppercase hover:brightness-125 transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)] active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    title="Previous Shelf (Left Arrow)"
                  >
                    <ChevronLeft size={14} /> <span>PREV</span>
                  </button>
                  <button
                    onClick={() => {
                      audioManager.playSfx('tap_nav', 0.15);
                      setVendingPage(prev => (prev + 1) % maxVendingPages);
                    }}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-b from-purple-800 via-purple-900 to-slate-950 border border-purple-400/50 text-purple-200 hover:text-white font-mono text-[10px] font-black tracking-wider uppercase hover:brightness-125 transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)] active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    title="Next Shelf (Right Arrow)"
                  >
                    <span>NEXT</span> <ChevronRight size={14} />
                  </button>
                </div>

                <span className="text-[9px] font-mono font-extrabold text-slate-400 tracking-widest uppercase text-center">
                  MATRIX SHELF SELECTOR
                </span>
                
                {/* Keypad Buttons */}
                <div className="grid grid-cols-3 gap-1.5 w-full">
                  {Array.from({ length: maxVendingPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setVendingPage(i)}
                      className={`h-9 rounded-lg font-mono text-xs font-black transition-all ${
                        i === vendingPage 
                          ? 'bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-[0_0_12px_#a855f7] border border-purple-300' 
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                  ))}
                </div>

                {/* 3D Mechanical Lever Handle */}
                <motion.div 
                  whileTap={{ rotateX: 55, y: 20 }}
                  onClick={handleLeverPull}
                  style={{ transformOrigin: 'top center' }}
                  className="w-12 h-28 rounded-full bg-gradient-to-b from-slate-300 via-slate-500 to-slate-800 border-4 border-slate-900 shadow-[0_12px_24px_rgba(0,0,0,0.8)] cursor-pointer flex flex-col items-center justify-start pt-2 group relative"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 via-red-600 to-red-900 shadow-[inset_0_-4px_8px_rgba(0,0,0,0.5),_0_0_20px_rgba(239,68,68,0.7)] group-hover:scale-105 transition-transform flex items-center justify-center">
                    <ChevronDown size={18} className="text-white/80 animate-bounce" />
                  </div>
                  <div className="w-full h-full flex flex-col justify-around py-2 items-center opacity-30">
                    <div className="w-6 h-0.5 bg-black" />
                    <div className="w-6 h-0.5 bg-black" />
                  </div>
                </motion.div>

                <button 
                  onClick={handleLeverPull}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 border border-amber-300 text-black text-[10px] font-mono font-black tracking-widest uppercase hover:brightness-125 transition-all text-center shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                >
                  PULL LEVER ➔
                </button>
              </div>

            </div>

            {/* ===== 4. RETRIEVAL CHUTE DOOR & STACK CONSOLE (SVG) ===== */}
            <div className="p-4 md:p-6 pt-2">
              <RetrievalChuteDoorSVG hasItems={vendedStack.length > 0} />

              <div className="mt-3 p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-[inset_0_10px_30px_rgba(0,0,0,0.8)] flex flex-col md:flex-row justify-between items-center gap-4">
                
                {/* Stack Status Info */}
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl transition-all ${
                    vendedStack.length > 0 
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.3)] animate-pulse' 
                      : 'bg-slate-900 border-slate-800 text-slate-600'
                  }`}>
                    📦
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                        PACK RETRIEVAL TRAY
                      </span>
                      {vendedStack.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-widest">
                          {vendedStack.length} {vendedStack.length === 1 ? 'PACK' : 'PACKS'} READY
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {vendedStack.length > 0 
                        ? `${vendedStack.reduce((sum, item) => sum + item.cards.length, 0)} total cards waiting to open`
                        : 'Vended packs drop here — stack multiple purchases then click Open All'}
                    </p>
                  </div>
                </div>

                {/* Stacked Pack Badges */}
                {vendedStack.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto max-w-xs md:max-w-md py-1 custom-scrollbar">
                    {vendedStack.map((item) => (
                      <div 
                        key={item.id} 
                        className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center gap-2 text-[10px] font-mono shrink-0 shadow-sm"
                      >
                        <span>{item.meta.icon}</span>
                        <span className="font-bold text-slate-200">{item.meta.label}</span>
                        <span className="text-slate-400">({item.meta.cardCount}c)</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Open All Button */}
                <div>
                  {vendedStack.length > 0 ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleOpenAllVendedPacks}
                      className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-amber-500 text-white font-extrabold text-xs uppercase tracking-widest shadow-[0_0_25px_rgba(168,85,247,0.5)] border border-white/20 flex items-center gap-2 hover:shadow-[0_0_35px_rgba(251,191,36,0.6)] transition-all"
                    >
                      <Sparkles size={16} className="text-amber-300 animate-spin" />
                      OPEN ALL PACKS ({vendedStack.length})
                    </motion.button>
                  ) : (
                    <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      TRAY EMPTY • VEND PACK FIRST
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===== GEN 0 BANNER ===== */}
      <section className="px-6 max-w-7xl mx-auto mb-12 relative z-10">
        <div className="relative rounded-3xl overflow-hidden p-8 border border-amber-500/30 bg-white/5 backdrop-blur-xl shadow-[0_0_40px_rgba(251,191,36,0.15)] group flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="relative z-10">
            <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-amber-500/20 border border-amber-500/30 rounded-full inline-block mb-3">
              EARLY ACCESS PROTOCOL
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight uppercase" style={{ textShadow: '0 0 20px rgba(251,191,36,0.5)' }}>
              Generation Zero
            </h2>
            <p className="text-amber-200/80 font-medium tracking-wide mt-2">
              First 100 collectors only. Gen 0 cards are never reminted.
            </p>
          </div>
          <div className="relative z-10 flex w-20 h-20 md:w-24 md:h-24 shrink-0 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 shadow-[0_0_30px_rgba(251,191,36,0.3)] animate-pulse">
            <Sparkles size={32} className="text-amber-400" />
          </div>
        </div>
      </section>

      {/* ===== TOKEN SINKS CONSOLE ===== */}
      {user && (
        <section className="py-12 px-6 max-w-7xl mx-auto relative z-10">
          <SectionLabel label="Economy Operations" accent="#fbbf24" />
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Zap size={220} />
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 relative z-10">
              <div>
                <h2 className="text-3xl font-extrabold text-white tracking-tight mb-1">Token Sinks Console</h2>
                <p className="text-sm text-slate-400">Targeted pulls, quick upgrades, and duplicate fusion</p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold text-sm self-start md:self-auto">
                {tokenBalance} V⚡ Available
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              {/* TARGETED PULL */}
              <div className="flex flex-col p-6 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-blue-500/40 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-xl">🎯</div>
                  <h3 className="font-bold text-lg text-white">Targeted Pull</h3>
                </div>
                <p className="text-xs text-slate-400 mb-6 flex-1">
                  Choose a specific day (1-365) to pull a guaranteed card from that drop.
                </p>
                
                <input 
                  type="number" min="1" max="365" 
                  value={targetDay} onChange={(e) => setTargetDay(e.target.value)}
                  placeholder="Target Day (1-365)" 
                  className="w-full bg-black/50 border border-white/10 rounded-xl text-white text-sm p-3.5 focus:border-blue-500 outline-none mb-4 transition-colors font-mono"
                />
                <button 
                  disabled={targetLoading || !targetDay || parseInt(targetDay) < 1 || parseInt(targetDay) > 365 || tokenBalance < 500}
                  onClick={() => handleTargetedPull(parseInt(targetDay))}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs tracking-wider uppercase transition-all disabled:opacity-50"
                >
                  {targetLoading ? 'Pulling...' : 'Pull Card (500 V⚡)'}
                </button>
              </div>

              {/* QUICK RARITY UPGRADE */}
              <div className="flex flex-col p-6 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-amber-500/40 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl">⚡</div>
                  <h3 className="font-bold text-lg text-white">Tier Upgrade</h3>
                </div>
                <p className="text-xs text-slate-400 mb-6 flex-1">
                  Instantly upgrade any card you own below Legendary tier by +1 rarity level.
                </p>
                <select 
                  value={upgradeCardId} onChange={(e) => setUpgradeCardId(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl text-white text-sm p-3.5 focus:border-amber-500 outline-none mb-4 transition-colors"
                >
                  <option value="">Select Card</option>
                  {upgradeableCards.map(c => (
                    <option key={c.id} value={c.id}>
                      Day {c.card.day}: {c.card.title} ({c.card.rarity})
                    </option>
                  ))}
                </select>
                <button 
                  disabled={upgradeLoading || !upgradeCardId || tokenBalance < 150}
                  onClick={() => handleUpgrade(upgradeCardId)}
                  className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs tracking-wider uppercase transition-all disabled:opacity-50"
                >
                  {upgradeLoading ? 'Upgrading...' : 'Upgrade (150 V⚡)'}
                </button>
              </div>

              {/* DUPLICATE FUSION */}
              <div className="flex flex-col p-6 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-red-500/40 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-xl">🔥</div>
                  <h3 className="font-bold text-lg text-white">Duplicate Fusion</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4 flex-1">
                  Combine 3 identical cards (same day + rarity) into 1 upgraded card.
                </p>
                
                <div className="flex-1 space-y-2 max-h-[120px] overflow-y-auto pr-2 mb-4 custom-scrollbar">
                  {fusableGroups.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-4 bg-black/30 rounded-xl border border-white/5">No fusable triplets found.</div>
                  ) : (
                    fusableGroups.map(([key, cards]) => {
                      const first = cards[0];
                      return (
                        <div key={key} className="flex items-center justify-between p-2.5 rounded-xl bg-black/50 border border-white/5">
                          <div className="text-xs text-slate-300">
                            Day {first.card.day} <span className="text-xs font-bold capitalize text-slate-400 ml-1">{first.card.rarity}</span>
                          </div>
                          <button
                            disabled={fusionLoading}
                            onClick={() => handleFusion(cards.slice(0, 3))}
                            className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                          >
                            Fuse
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="text-center py-2 text-xs font-bold text-slate-500 uppercase tracking-widest">Cost: Free</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== DECRYPTION & THE FORGE ROW ===== */}
      <section className="py-12 px-6 max-w-7xl mx-auto relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* THE FORGE */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          onClick={() => setLocation('/vault/forge')}
          className="relative overflow-hidden cursor-pointer rounded-3xl p-8 bg-gradient-to-br from-slate-900 via-slate-950 to-black border border-white/10 shadow-2xl group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col h-full justify-between gap-6">
            <div>
              <SectionLabel label="Card Incinerator" accent="#ef4444" />
              <h2 className="text-4xl font-extrabold text-white tracking-tight mb-2">The Forge</h2>
              <p className="text-sm text-slate-400">Burn duplicate cards to extract V⚡ tokens & release echo score prestige.</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-wider">
                Enter Incinerator
              </span>
              <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors">
                →
              </span>
            </div>
          </div>
        </motion.div>

        {/* PROMO CONSOLE */}
        {user ? (
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl">
            <SectionLabel label="Decryption Terminal" accent="#3b82f6" />
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Promo Codes</h2>
            <p className="text-sm text-slate-400 mb-6">Enter cryptographic keys to unlock exclusive rewards.</p>
            
            <form onSubmit={handleBonusRedeem} className="flex gap-3 mb-4">
              <input
                type="text"
                value={bonusCode}
                onChange={e => setBonusCode(e.target.value)}
                placeholder="ENTER PROMO CODE"
                disabled={codeState === 'redeeming'}
                className="flex-1 bg-black/50 border border-white/10 rounded-xl text-white font-mono text-sm p-3.5 focus:border-blue-500 outline-none uppercase"
              />
              <button
                type="submit"
                disabled={codeState === 'redeeming' || !bonusCode.trim()}
                className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {codeState === 'redeeming' ? 'Decrypting...' : 'Redeem'}
              </button>
            </form>
            {codeState === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 p-3.5 rounded-xl border border-red-400/20">
                <AlertTriangle size={16} /> {codeError}
              </div>
            )}
            
            <AnimatePresence mode="popLayout">
              {codeState === 'success' && rewardClaimed && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mt-6 flex flex-col gap-2"
                >
                  {rewardClaimed.type === 'tokens' && (
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <motion.div 
                        animate={{ y: [0, -5, 0] }} 
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center"
                      >
                        <Zap size={24} className="text-amber-400" />
                      </motion.div>
                      <div>
                        <div className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">VAULT TOKENS CREDITED</div>
                        <div className="text-2xl font-extrabold text-amber-400">+{rewardClaimed.details?.tokensGranted || rewardClaimed.value} V⚡</div>
                      </div>
                    </div>
                  )}

                  {rewardClaimed.type === 'background_skin' && (
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                      <motion.div 
                        animate={{ scale: [1, 1.1, 1] }} 
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center"
                      >
                        <ImageIcon size={24} className="text-green-400" />
                      </motion.div>
                      <div>
                        <div className="text-[10px] font-bold text-green-300 uppercase tracking-widest">SKIN UNLOCKED</div>
                        <div className="text-xl font-extrabold text-green-400">{rewardClaimed.details?.skinUnlocked || rewardClaimed.value}</div>
                      </div>
                    </div>
                  )}

                  {rewardClaimed.type === 'cheat_code' && (
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                      <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Terminal size={24} className="text-purple-400" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">ACCESS DECRYPTED</div>
                        <div className="text-lg font-bold text-purple-400">
                          {rewardClaimed.value === 'iddqd' ? 'MISS SYSTEM SAFETY BYPASSED' : 'PROCEDURAL GENERATOR DECRYPTED'}
                        </div>
                      </div>
                    </div>
                  )}

                  {rewardClaimed.type === 'age_verification' && (
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                      <div className="text-3xl">🔞</div>
                      <div>
                        <div className="text-[10px] font-bold text-red-300 uppercase tracking-widest">DECRYPTION COMPLETE</div>
                        <div className="text-lg font-bold text-red-400">{rewardClaimed.details?.skinUnlocked || "Content Unlocked"}</div>
                      </div>
                    </div>
                  )}
                  
                  {(!rewardClaimed.type || !['tokens', 'background_skin', 'cheat_code', 'age_verification'].includes(rewardClaimed.type)) && (
                    <div className="flex items-center gap-3 text-sm text-green-400 bg-green-400/10 p-4 rounded-xl border border-green-400/20">
                      <Sparkles size={20} /> Successfully decrypted reward!
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl flex flex-col justify-between">
            <div>
              <SectionLabel label="Authentication Protocol" accent="#fbbf24" />
              <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Connect Wallet</h2>
              <p className="text-sm text-slate-400">Unlock your personal token sinks console, daily drops, and promo codes.</p>
            </div>
            <button 
              onClick={() => useAuthStore.getState().setConnectModalOpen(true)}
              className="mt-6 w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-amber-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg"
            >
              Connect Wallet Now
            </button>
          </div>
        )}
      </section>

      {/* ===== AGE GATE MODAL ===== */}
      <AnimatePresence>
        {ageGateCode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-amber-500/30 shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl mb-4">
                🔞
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Restricted Vault Content</h3>
              <p className="text-xs text-slate-400 mb-6">
                This promo reward contains age-restricted audio/artwork. You must verify that you are 18+ to claim.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setAgeGateCode(null)}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  disabled={ageVerifying}
                  onClick={handleAgeVerificationConfirm}
                  className="flex-1 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs uppercase"
                >
                  {ageVerifying ? 'Verifying...' : 'I am 18+'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="relative z-10 py-12 mt-12 border-t border-white/5 bg-transparent text-center">
        <div className="max-w-4xl mx-auto px-6 space-y-3">
          <div className="flex justify-center items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-widest">
            <Shield size={14} /> PIM Vault Protocol v2.0
          </div>
          <p className="text-xs text-slate-600 uppercase tracking-wide">
            Cryptographic audio signatures ensure verifiable ownership. Secure neural link established.
          </p>
        </div>
      </footer>

      {isClaimingAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="text-center space-y-4">
            <div className="text-6xl animate-bounce">✨</div>
            <h2 className="text-4xl font-extrabold text-white tracking-tight">Drop Claimed!</h2>
          </div>
        </div>
      )}

    </div>
  );
}
