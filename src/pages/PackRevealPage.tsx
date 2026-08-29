import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useVaultStore } from '../store/useVaultStore';
import Card from '../components/Card';
import RarityBadge from '../components/RarityBadge';
import { RARITY_CONFIG, getSupplyCap, type Rarity } from '../utils/rarity';
import { ArrowRight } from 'lucide-react';
import UltraRewardModal from '../components/UltraRewardModal';
import PackRipAnimation from '../components/PackRipAnimation';
import PackContainer from '../components/cinematic/PackContainer';

import { purchasePack, buyTokenPack, sellCard, getTokenPackCost, verifyStripeSessionDetailed, type OwnedCard } from '../services/vaultService';
import { PACK_CONFIGS, type PackCategory, type PackSize } from '../utils/rarity';
import { getRandomBombshellPackCover } from '../utils/bombshellCards';
import { audioManager } from '../game/audio';
import { haptics } from '../utils/haptics';
import { useLoadingToast } from '../store/useLoadingToast';

export default function PackRevealPage() {
  const [, setLocation] = useLocation();
  const { revealCards, endReveal, revealPackMeta, startReveal, addToCollection, removeFromCollection, loadVaultData, tokenBalance } = useVaultStore();
  const [isRepurchasing, setIsRepurchasing] = useState(false);
  const isRepurchaseRef = useRef(false);
  const [accumulatedCards, setAccumulatedCards] = useState<OwnedCard[]>(() => revealCards);
  const [revealedIndex, setRevealedIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [ultraModalOpen, setUltraModalOpen] = useState(false);
  const [tokenReward, setTokenReward] = useState<{ tokenAmount: number; newBalance?: number } | null>(null);
  // 'tap' → PackRipAnimation, 'cinematic' → PackContainer, 'slide' → skip straight to cards
  const [ripDone, setRipDone] = useState(
    () => !revealPackMeta || (revealPackMeta.revealType !== 'tap' && revealPackMeta.revealType !== 'cinematic')
  );

  // Sync ripDone and accumulatedCards whenever a new reveal is initiated
  useEffect(() => {
    if (revealPackMeta) {
      setRipDone(revealPackMeta.revealType !== 'tap' && revealPackMeta.revealType !== 'cinematic');
    }
  }, [revealPackMeta]);

  useEffect(() => {
    if (isRepurchaseRef.current) {
      isRepurchaseRef.current = false;
      return;
    }
    setAccumulatedCards(revealCards);
  }, [revealCards]);

  // Check for Stripe Session ID on mount if revealCards is empty
  useEffect(() => {
    if (revealCards.length === 0) {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const category = (params.get('category') || 'taste') as PackCategory;
      const size = (params.get('size') || 'single') as PackSize;

      if (sessionId) {
        window.history.replaceState({}, '', '/vault/reveal');
        useLoadingToast.getState().show('Verifying Stripe payment…');
        verifyStripeSessionDetailed(sessionId, category, size)
          .then(async (result) => {
            useLoadingToast.getState().hide();
            if (result.isTokenBundle) {
              await loadVaultData();
              setTokenReward({ tokenAmount: result.tokenAmount || 0, newBalance: result.newBalance });
              try { audioManager.playSfx('tap_perfect'); } catch {}
              return;
            }

            const cards = result.cards || [];
            if (cards && cards.length > 0) {
              addToCollection(cards);
              await loadVaultData();
              const cfg = PACK_CONFIGS[category] || {
                category: category || 'bombshell',
                label: category === 'bombshell' ? 'BOMBSHELL PACK' : 'VAULT PACK',
                description: 'Exclusive artwork cards',
                icon: category === 'bombshell' ? '💖' : '⚡',
                accent: category === 'bombshell' ? '#FF1493' : '#00E5FF',
                gradient: category === 'bombshell' 
                  ? 'linear-gradient(160deg, #300a1e 0%, #501234 40%, #200816 100%)'
                  : 'linear-gradient(160deg, #0a1020 0%, #152540 40%, #081018 100%)',
                tiers: [{ size: size || 'single', cardCount: cards.length, price: '$0.25' }]
              };
              const tier = cfg?.tiers?.find(t => t.size === size) ?? cfg?.tiers?.[0] ?? { size: (size || 'single') as PackSize, cardCount: cards.length, price: '$0.25' };
              setRipDone(false);
              setRevealedIndex(0);
              setShowSummary(false);
              setAccumulatedCards(cards);
              startReveal(cards, {
                category: (cfg.category || category) as PackCategory,
                size: (tier.size || size) as PackSize,
                label: cfg.label || 'BOMBSHELL PACK',
                icon: cfg.icon || '💖',
                accent: cfg.accent || '#FF1493',
                gradient: cfg.gradient || 'linear-gradient(160deg, #300a1e 0%, #501234 40%, #200816 100%)',
                price: tier.price || '$0.25',
                cardCount: cards.length,
                revealType: 'cinematic',
              });
            } else {
              alert('Could not verify cards for this Stripe session.');
              setLocation('/vault');
            }
          })
          .catch((err) => {
            console.error('Stripe verification failed:', err);
            useLoadingToast.getState().hide();
            setLocation('/vault');
          });
        return;
      }

      setLocation('/vault');
      return;
    }
  }, [revealCards, setLocation, addToCollection, loadVaultData, startReveal]);

  useEffect(() => {
    if (ripDone && revealPackMeta?.revealType !== 'cinematic' && revealedIndex >= 0 && revealedIndex < revealCards.length - 1) {
      const timer = setTimeout(() => setRevealedIndex(i => i + 1), 1200);
      return () => clearTimeout(timer);
    } else if (ripDone && revealPackMeta?.revealType !== 'cinematic' && revealedIndex >= revealCards.length - 1 && revealCards.length > 0) {
      const timer = setTimeout(() => setShowSummary(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [revealedIndex, revealCards.length, ripDone, revealPackMeta]);

  // Haptic feedback triggers
  useEffect(() => {
    if (ripDone) {
      haptics.packReveal();
    }
  }, [ripDone]);

  useEffect(() => {
    if (ripDone) {
      haptics.cardFlip();
    }
  }, [revealedIndex, ripDone]);

  useEffect(() => {
    if (showSummary) {
      haptics.mediumTap();
    }
  }, [showSummary]);

  useEffect(() => {
    const current = revealCards[revealedIndex];
    if (current?.ultraReward) {
      const t = setTimeout(() => setUltraModalOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [revealedIndex, revealCards]);

  const handleDone = () => {
    const redirect = revealPackMeta?.redirectPath;
    endReveal();
    if (redirect) {
      setLocation(redirect);
    } else {
      setLocation('/vault/collection');
    }
  };

  const handleBuyAnother = async () => {
    if (!revealPackMeta || !revealPackMeta.category || !revealPackMeta.size) {
      endReveal();
      setLocation('/vault');
      return;
    }
    const { category, size } = revealPackMeta;

    // Client-side balance guard for token packs
    const reqCost = category === 'bombshell_token' ? 100 : getTokenPackCost();
    if ((category === 'vault_token' || category === 'bombshell_token') && tokenBalance < reqCost) {
      alert(`Not enough V⚡ tokens. You need ${reqCost} V⚡ but only have ${tokenBalance}.`);
      return;
    }

    setIsRepurchasing(true);
    isRepurchaseRef.current = true;

    try {
      const cards = (category === 'vault_token' || category === 'bombshell_token')
        ? await buyTokenPack(category)
        : await purchasePack(category as any, size as any);

      if (cards === 'insufficient') {
        alert(`Not enough V⚡ tokens. You need ${reqCost} V⚡ but only have ${tokenBalance}.`);
        setIsRepurchasing(false);
        isRepurchaseRef.current = false;
        return;
      }

      if (cards && cards.length > 0) {
        audioManager.playSfx('open_chest', 0.9);
        addToCollection(cards);
        await loadVaultData();
        setRevealedIndex(0);
        setShowSummary(false);
        setAccumulatedCards((prev) => [...prev, ...cards]);
        const newRipDone = revealPackMeta.revealType !== 'tap' && revealPackMeta.revealType !== 'cinematic';
        setRipDone(newRipDone);
        const isBombshell = category === 'bombshell_token' || category === 'bombshell';
        const newCover = isBombshell
          ? getRandomBombshellPackCover()
          : revealPackMeta.coverImage;
        startReveal(cards, { ...revealPackMeta, coverImage: newCover, cardCount: cards.length });
      } else {
        isRepurchaseRef.current = false;
      }
    } catch (e) {
      console.error('Repurchase error:', e);
      isRepurchaseRef.current = false;
    } finally {
      setIsRepurchasing(false);
    }
  };

  const handleBurn = async (owned: any) => {
    const confirm = window.confirm('Burn this minted-out card immediately?');
    if (!confirm) return;
    
    const res = await sellCard(owned);
    if (res.tokensEarned > 0) {
      removeFromCollection(owned.id);
      await loadVaultData();
      // If we are in the single reveal view, we might want to move to the next card or show summary if it was the last one
      if (!showSummary) {
        if (revealedIndex < revealCards.length - 1) {
          setRevealedIndex(i => i + 1);
        } else {
          setShowSummary(true);
        }
      }
    }
  };

  if (tokenReward) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 min-h-[80vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-md w-full p-8 rounded-2xl text-center space-y-6"
          style={{
            background: 'linear-gradient(180deg, rgba(255,184,0,0.12) 0%, rgba(10,10,10,0.95) 100%)',
            border: '2px solid rgba(255,184,0,0.4)',
            boxShadow: '0 0 50px rgba(255,184,0,0.15), 6px 6px 0 #000',
          }}
        >
          <div className="w-20 h-20 mx-auto rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center text-4xl shadow-lg animate-pulse">
            ⚡
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
              Payment Cleared • Vault Wallet Credited
            </span>
            <h2 className="text-3xl font-black uppercase tracking-tight text-white">
              +{tokenReward.tokenAmount} V⚡ SPARKS
            </h2>
            <p className="text-xs font-mono text-zinc-400 leading-relaxed">
              Your sparks have been delivered to your vault wallet. Use them to rip Vault Packs (3% Mythic drop chance), execute Targeted Pulls, or boost cards in the Forge!
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/60 border border-amber-500/20 text-left space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-zinc-500">Vault Packs Unlocked</span>
              <span className="text-amber-400 font-bold">~{Math.floor(tokenReward.tokenAmount / 275)} Packs ({Math.floor(tokenReward.tokenAmount / 275) * 3} Cards)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Current Balance</span>
              <span className="text-white font-bold">{tokenBalance} V⚡</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                setTokenReward(null);
                setLocation('/vault');
              }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black uppercase text-xs tracking-wider transition-all active:scale-[0.98] cursor-pointer"
              style={{ border: '2px solid #000', boxShadow: '3px 3px 0 #000' }}
            >
              ✦ RIP VAULT PACKS NOW (3% MYTHIC)
            </button>
            <button
              onClick={() => {
                setTokenReward(null);
                setLocation('/vault');
              }}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-mono uppercase text-[10px] tracking-wider transition-all"
            >
              Return to Vault Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (revealCards.length === 0) return null;

  // ── CINEMATIC reveal (third animation) ─────────────────────────────
  if (!ripDone && revealPackMeta?.revealType === 'cinematic') {
    return (
      <PackContainer
        key={`pack-${revealCards[0]?.id}`}
        meta={revealPackMeta}
        cards={revealCards}
        accumulatedCards={accumulatedCards}
        onComplete={handleDone}
        onBuyAnother={revealPackMeta?.showRipAnother ? handleBuyAnother : undefined}
        isRepurchasing={isRepurchasing}
      />
    );
  }

  // ── Tap-to-open bag (daily / month / vault packs) ──────────────────
  if (!ripDone && revealPackMeta?.revealType === 'tap') {
    return <PackRipAnimation key={`tap-${revealCards[0]?.id}`} meta={revealPackMeta} onComplete={() => setRipDone(true)} />;
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 min-h-[80vh]">
      {/* Card reveal */}
      {revealedIndex >= 0 && !showSummary && (
        <div className="text-center space-y-6">
          <motion.div
            key={`counter-${revealedIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs font-mono"
            style={{ color: 'var(--color-text-muted)' }}
          >
            CARD {revealedIndex + 1} / {revealCards.length}
          </motion.div>

          <div className="relative w-[240px] md:w-[280px]">
            <AnimatePresence mode="wait">
              {revealCards.map((owned, i) => {
                if (i !== revealedIndex) return null;
                const rarityConfig = RARITY_CONFIG[owned.card.rarity];

                return (
                  <motion.div
                    key={owned.id}
                    initial={{ opacity: 0, rotateY: -90, scale: 0.5 }}
                    animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -200, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    style={{ perspective: '1000px' }}
                  >
                    <Card 
                      card={owned.card}
                      edition={owned.edition}
                      interactive={false} 
                      showAudio 
                      isDailyOrigin={owned.source === 'daily_claim' || owned.source === 'pack_miss_out'} 
                      ultraReward={owned.ultraReward} 
                      isEcho={owned.isEcho} 
                      echoGeneration={owned.echoGeneration}
                      onBurn={(owned.edition || 0) > getSupplyCap(owned.card.rarity as Rarity, owned.card.day) ? () => handleBurn(owned) : undefined}
                      proof={owned.proof}
                    />

                    {owned.card.rarity === 'mythic' ? (
                      <>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.2 }}
                          animate={{ opacity: [0, 1, 0], scale: [0.2, 2.5, 3.8] }}
                          transition={{ duration: 1.4, ease: 'easeOut' }}
                          className="absolute -inset-10 rounded-full pointer-events-none z-40"
                          style={{
                            background: 'radial-gradient(circle, #ffffff 0%, #ffd700 45%, rgba(255,0,127,0.3) 70%, transparent 90%)',
                            animation: 'mythic-supernova-blast 1.4s cubic-bezier(0.1, 0.8, 0.3, 1) forwards',
                          }}
                        />
                        <motion.div
                          initial={{ scale: 0.6, opacity: 0, y: 20 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          transition={{ delay: 0.3, type: 'spring' }}
                          className="absolute -top-12 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-xl bg-black/90 border border-[#ffd700] shadow-[0_0_25px_rgba(255,215,0,0.8)] flex items-center gap-2 whitespace-nowrap z-50 pointer-events-none"
                        >
                          <span className="text-xs text-[#ffd700] animate-spin">✦</span>
                          <span className="font-mono text-[11px] font-black text-[#ffd700] tracking-widest uppercase">
                            MYTHIC 1 OF 1 DISCOVERED!
                          </span>
                          <span className="text-xs text-[#ffd700] animate-spin" style={{ animationDirection: 'reverse' }}>✦</span>
                        </motion.div>
                      </>
                    ) : owned.card.rarity === 'legendary' ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 2, 3] }}
                        transition={{ duration: 1, delay: 0.3 }}
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{
                          background: `radial-gradient(circle, ${rarityConfig.color}30, transparent 60%)`,
                        }}
                      />
                    ) : null}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <motion.div
            key={`badge-${revealedIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <RarityBadge rarity={revealCards[revealedIndex]?.card.rarity || 'common'} size="lg" />
            {(revealCards[revealedIndex]?.proof === 'proof_of_first' || revealCards[revealedIndex]?.proof === 'heard_first') && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                className="mt-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold"
                style={{
                  background: revealCards[revealedIndex].proof === 'proof_of_first'
                    ? 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(167,139,250,0.05))'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))',
                  border: `1px solid ${revealCards[revealedIndex].proof === 'proof_of_first' ? 'rgba(167,139,250,0.4)' : 'rgba(239,68,68,0.4)'}`,
                  color: revealCards[revealedIndex].proof === 'proof_of_first' ? '#a78bfa' : '#ef4444',
                }}
              >
                {revealCards[revealedIndex].proof === 'proof_of_first'
                  ? '🔮 PROOF OF FIRST (1/1)'
                  : '🎲 HEARD FIRST PROOF (1/1)'}
              </motion.div>
            )}
          </motion.div>
        </div>
      )}

      {/* Summary */}
      {showSummary && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl space-y-6"
        >
          <h2 className="text-2xl font-bold text-center text-gradient">Pack Opened!</h2>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {revealCards.map((owned, i) => (
              <motion.div
                key={owned.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card 
                  card={owned.card}
                  edition={owned.edition}
                  interactive={false} 
                  delay={i} 
                  isDailyOrigin={owned.source === 'daily_claim' || owned.source === 'pack_miss_out'} 
                  ultraReward={owned.ultraReward} 
                  isEcho={owned.isEcho} 
                  echoGeneration={owned.echoGeneration}
                  onBurn={(owned.edition || 0) > getSupplyCap(owned.card.rarity as Rarity, owned.card.day) ? () => handleBurn(owned) : undefined}
                  proof={owned.proof}
                />
              </motion.div>
            ))}
          </div>

          <div
            className="flex items-center justify-center gap-4 p-3 rounded-xl"
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {['common', 'uncommon', 'rare', 'legendary', 'mythic'].map((r) => {
              const count = revealCards.filter(c => c.card.rarity === r).length;
              if (count === 0) return null;
              return (
                <div key={r} className="flex items-center gap-1.5">
                  <span className="text-sm font-bold font-mono" style={{ color: RARITY_CONFIG[r as keyof typeof RARITY_CONFIG].color }}>
                    {count}×
                  </span>
                  <RarityBadge rarity={r as any} size="sm" />
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { endReveal(); setLocation('/vault'); }}
              className="px-4 py-3 rounded-xl font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
              }}
            >
              ←
            </button>
            {revealPackMeta?.showRipAnother && (() => {
              const isTokenPack = revealPackMeta?.category === 'vault_token';
              const cantAfford = isTokenPack && tokenBalance < getTokenPackCost();
              const isDisabled = isRepurchasing || !revealPackMeta?.size || cantAfford;
              return (
                <button
                  onClick={handleBuyAnother}
                  disabled={isDisabled}
                  title={cantAfford ? `Need ${getTokenPackCost()} V⚡ (you have ${tokenBalance})` : undefined}
                  className="flex-1 py-3 rounded-xl font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: cantAfford ? 'var(--color-surface-1)' : 'var(--color-surface-2)',
                    border: `1px solid ${cantAfford ? 'var(--color-border-subtle)' : 'var(--color-neon-purple)'}`,
                    color: cantAfford ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                    opacity: isDisabled ? 0.5 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isRepurchasing ? 'RIPPING...' : cantAfford ? `NEED ${getTokenPackCost()} V⚡` : 'RIP ANOTHER'}
                </button>
              );
            })()}
            <button
              onClick={handleDone}
              className="flex-1 py-3 rounded-xl font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, var(--color-neon-yellow), var(--color-neon-cyan))',
                color: 'var(--color-void-black)',
              }}
            >
              {revealPackMeta?.category === 'daily_claim' || revealPackMeta?.redirectPath === '/tutorial' || revealPackMeta?.redirectPath?.startsWith('/play/') ? (
                <>Start PIM <ArrowRight size={16} /></>
              ) : (
                <>Collection <ArrowRight size={16} /></>
              )}
            </button>
          </div>
        </motion.div>
      )}

      <UltraRewardModal
        isOpen={ultraModalOpen}
        onClose={() => setUltraModalOpen(false)}
        isFreshFind
      />
    </div>
  );
}
